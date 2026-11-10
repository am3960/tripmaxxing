# TripMaxxing Architecture

This document is the implementation reference for agents working on TripMaxxing. The MVP is a functional vertical slice: user preferences go in, and a budget-aware itinerary that can be regenerated or adapted comes out.

## MVP boundaries

### Included

- New York City trips lasting one to three days
- Trip preferences: dates, budget, interests, dietary needs, and pace
- Generated daily schedules with estimated costs and travel times
- Budget enforcement, opening-hour checks, and dietary filtering
- Activity swaps, cheaper alternatives, and spontaneous suggestions
- Sample weather and outfit guidance
- Curated local travel data and Google Maps links

### Deferred

- Accounts stored in a database
- Payments and bookings
- Live Google Places, Routes, Ticketmaster, and weather integrations
- A full interactive map
- Machine-learned preference models or an LLM

Google sign-in (a server session, with no database) and trips saved in this browser are already in the app. Keep both when changing the planner. The sample itinerary is generated in the frontend until `POST /api/plan` exists. Do not remove that planner when editing the auth API.

The MVP must describe prices, ratings, weather, and travel times as estimates from sample data. Do not present them as live information.

## System design

```text
React + TypeScript UI
        |
        | POST /api/plan
        v
FastAPI API
  - validates requests
  - coordinates providers and optimizer
        |
        +--------------------+
        |                    |
        v                    v
Provider layer         Optimization engine
  - places              - eligibility filters
  - weather             - candidate ranking
  - normalized data     - constraint-aware scheduling
        |                    |
        +---------+----------+
                  v
          Itinerary response
```

### Frontend

Use Vite, React, and TypeScript. The UI owns:

- Trip preference input and validation feedback
- Loading and error states
- Day-by-day itinerary presentation
- Budget summary, alternatives, weather note, and outfit tip
- Activity swaps by regenerating with the selected place ID excluded

The frontend consumes the API contract and contains no scheduling logic.

### API

Use FastAPI and Pydantic. The API owns:

- `GET /api/health`
- `POST /api/plan`
- Request and response validation
- CORS configuration
- Unsupported-destination and invalid-input errors
- Coordination of providers and the optimizer

The API must not duplicate provider or optimization logic.

### Provider layer

Start with approximately 20 curated NYC places in local JSON. Normalize all provider data before passing it to the optimizer.

Required interfaces:

```python
load_places(destination: str) -> list[dict]
load_weather(destination: str, date: str) -> dict
```

Keep providers replaceable so live Google Places, Google Routes, Ticketmaster, and weather adapters can be introduced without changing the optimizer.

### Optimization engine

Use a deterministic, constraint-aware greedy heuristic. Do not describe it as a trained AI model.

Required interface:

```python
build_itinerary(request, places, weather) -> dict
```

Processing order:

1. Remove excluded or ineligible places.
2. Enforce destination, dietary, opening-hour, time, and budget constraints.
3. Rank candidates by interest match, rating, cost, category variety, and geographic proximity.
4. Assign valid candidates to days and times without conflicts.
5. Estimate travel using Haversine distance and label it approximate.
6. Return scheduled stops, totals, warnings, and ranked alternatives.

Hard constraints:

- Total budget per person
- Daily available time
- Opening hours and availability
- Dietary requirements
- Explicitly excluded activities

Soft preferences:

- Interest match
- Higher ratings
- Shorter travel distance
- Category variety
- Lower cost
- User-selected pace

## API contract

`budget_usd` is the total estimated activity and food spending per person for the whole trip. It excludes lodging and transportation fares.

### Request

```json
{
  "destination": "New York City",
  "start_date": "2026-11-14",
  "days": 2,
  "budget_usd": 250,
  "interests": ["food", "art", "outdoors"],
  "pace": "balanced",
  "dietary": ["vegetarian"],
  "excluded_place_ids": []
}
```

### Response

```json
{
  "destination": "New York City",
  "start_date": "2026-11-14",
  "days": [
    {
      "date": "2026-11-14",
      "stops": [
        {
          "id": "central-park",
          "name": "Central Park",
          "category": "outdoors",
          "summary": "Explore the park",
          "start_time": "09:00",
          "end_time": "10:30",
          "duration_min": 90,
          "price_usd": 0,
          "rating": 4.8,
          "lat": 40.7829,
          "lng": -73.9654,
          "travel_min_from_previous": 0,
          "booking_required": false
        }
      ],
      "day_total_usd": 0
    }
  ],
  "trip_total_usd": 0,
  "remaining_budget_usd": 250,
  "alternatives": [],
  "weather_note": "Sample weather information",
  "outfit_tip": "Bring comfortable walking shoes",
  "warnings": [],
  "data_source": "sample"
}
```

Alternatives use the same core place fields as itinerary stops.

## Suggested project layout

```text
frontend/
  src/
    components/
      TripForm.tsx
      ItineraryView.tsx
    App.tsx
    types.ts
    app.css
backend/
  data/
    nyc_places.json
  tests/
    test_optimizer.py
  main.py
  schemas.py
  providers.py
  optimizer.py
  requirements.txt
docs/
  ARCHITECTURE.md
```

## Quality requirements

- Changing the budget or interests must produce a meaningfully different valid plan.
- Swapping a stop must exclude it and regenerate the itinerary.
- The itinerary total must never exceed the requested budget.
- Stops must not be scheduled outside known opening hours.
- Dietary exclusions must be respected.
- API schemas and frontend types must remain aligned.
- Tests must cover budget enforcement, opening hours, dietary filtering, and regeneration with exclusions.
- The app must clearly distinguish sample estimates from live data.

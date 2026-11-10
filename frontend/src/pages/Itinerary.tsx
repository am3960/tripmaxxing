import { useState } from "react";
import { Link } from "react-router-dom";
import { applyCheaperSwap } from "../api/plan";
import DayCard from "../components/DayCard";
import TripMap from "../components/TripMap";
import { formatMoney } from "../format";
import { loadCurrent, saveCurrent, saveTrip } from "../storage";

export default function Itinerary() {
  const [trip, setTrip] = useState(() => loadCurrent());
  const [saved, setSaved] = useState(false);

  if (!trip) {
    return (
      <section className="panel">
        <p className="eyebrow">Itinerary</p>
        <h1>No draft yet</h1>
        <p className="lede">
          Build one from your trip details. <Link to="/plan">Start planning</Link>
        </p>
      </section>
    );
  }

  const overBy = trip.totalCostUsd - trip.budgetUsd;

  function update(next: typeof trip) {
    if (!next) return;
    saveCurrent(next);
    setTrip(next);
    setSaved(false);
  }

  return (
    <section className="panel">
      <p className="eyebrow">Itinerary · sample estimates</p>
      <h1>{trip.destination}</h1>
      <p className="lede">
        {trip.days.length} {trip.days.length === 1 ? "day" : "days"} · {trip.totalTravelMin} min of travel between
        stops
        {trip.stops.length > 0 ? ` · Also passing through ${trip.stops.join(", ")}` : ""}
      </p>
      <p className={overBy > 0 ? "banner over" : "banner"}>
        {overBy > 0
          ? `This draft is ${formatMoney(overBy)} over your ${formatMoney(trip.budgetUsd)} budget.`
          : `${formatMoney(trip.totalCostUsd)} estimated of your ${formatMoney(trip.budgetUsd)} budget. ${formatMoney(trip.budgetUsd - trip.totalCostUsd)} left.`}
      </p>
      {trip.warnings.map((warning) => (
        <p key={warning} className="warning">
          {warning}
        </p>
      ))}
      <p className="note">Costs, ratings, and travel times are sample estimates, not live data.</p>
      <TripMap places={[trip.destination, ...trip.stops]} />

      <div className="days">
        {trip.days.map((day, index) => (
          <DayCard
            key={day.date}
            day={day}
            swap={trip.swaps.find((option) => option.dayIndex === index)}
            onSwap={() => update(applyCheaperSwap(trip, index))}
          />
        ))}
      </div>

      {trip.extras.length > 0 && (
        <section className="extras">
          <h2>If you have extra time</h2>
          <ul>
            {trip.extras.map((extra) => (
              <li key={extra.id}>
                <strong>{extra.name}</strong>
                <span>
                  {extra.category} · {extra.durationMin} min · {formatMoney(extra.priceUsd)}
                </span>
                <p>{extra.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="row-actions">
        <button
          type="button"
          className="button"
          onClick={() => {
            saveTrip(trip);
            setSaved(true);
          }}
        >
          {saved ? "Saved" : "Save trip"}
        </button>
        <Link className="button secondary" to="/plan">
          Edit details
        </Link>
      </div>
    </section>
  );
}

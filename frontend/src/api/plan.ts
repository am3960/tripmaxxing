import { PLACES, type CatalogPlace } from "../data/places";
import type {
  Activity,
  ActivityKind,
  DayPlan,
  ExtraSuggestion,
  Itinerary,
  SwapOption,
  TripRequest,
} from "../types";

const DAY_LIMIT = 5;
const DAY_START_MIN = 9 * 60 + 30;

// Sample planner. Replace this body with POST /api/trips/plan later.
export async function planTrip(request: TripRequest): Promise<Itinerary> {
  return buildItinerary(request);
}

export function applyCheaperSwap(itinerary: Itinerary, dayIndex: number): Itinerary {
  const swap = itinerary.swaps.find((option) => option.dayIndex === dayIndex);
  if (!swap) return itinerary;

  const days = itinerary.days.map((day, index) => {
    if (index !== dayIndex) return day;
    const activities = retime(
      day.activities.map((activity) =>
        activity.id === swap.activityId
          ? {
              ...activity,
              ...swap.replacement,
              travelMinFromPrevious: activity.travelMinFromPrevious,
            }
          : activity,
      ),
    );
    return { ...day, activities, dayCostUsd: sumPrices(activities) };
  });

  return {
    ...itinerary,
    days,
    swaps: itinerary.swaps.filter((option) => option.dayIndex !== dayIndex),
    totalCostUsd: days.reduce((sum, day) => sum + day.dayCostUsd, 0),
    totalTravelMin: totalTravel(days),
  };
}

function buildItinerary(request: TripRequest): Itinerary {
  const { dates, truncated } = datesBetween(request.startDate, request.endDate);
  const used = new Set<string>();
  const purse = { remaining: request.budget };
  const days: DayPlan[] = dates.map((date, dayIndex) => {
    const activities = scheduleDay(request, dayIndex, purse, used);
    return { date, activities, dayCostUsd: sumPrices(activities) };
  });

  const swaps = days.flatMap((day, dayIndex) => {
    const swap = findSwap(request, day.activities, dayIndex, used);
    return swap ? [swap] : [];
  });

  const extras = rank(request, available(request, used))
    .slice(0, 2)
    .map((place) => toExtra(place, request.destination));

  const warnings: string[] = [];
  if (truncated) warnings.push("This sample plan covers the first 5 days.");
  const unscheduledStops = request.stops.slice(dates.length);
  if (unscheduledStops.length > 0) {
    warnings.push(`Not scheduled in this draft: ${unscheduledStops.join(", ")}.`);
  }

  return {
    id: itineraryId(request),
    destination: request.destination,
    stops: request.stops,
    startDate: request.startDate,
    endDate: request.endDate,
    budgetUsd: request.budget,
    totalCostUsd: days.reduce((sum, day) => sum + day.dayCostUsd, 0),
    totalTravelMin: totalTravel(days),
    days,
    swaps,
    extras,
    warnings,
    dataSource: "sample",
    createdAt: new Date().toISOString(),
  };
}

function scheduleDay(
  request: TripRequest,
  dayIndex: number,
  purse: { remaining: number },
  used: Set<string>,
): Activity[] {
  const slots: ActivityKind[] =
    request.preferences.pace === "packed"
      ? ["activity", "lunch", "activity", "dinner"]
      : ["activity", "lunch", "activity"];
  const stopName = request.stops[dayIndex];
  if (stopName) slots[slots.length - 1] = "stop";

  const chosen: Activity[] = [];
  let hasMeal = false;

  slots.forEach((slot) => {
    const previous = chosen[chosen.length - 1];
    if (slot === "stop" && stopName) {
      chosen.push(
        blankActivity({
          id: `stop-${dayIndex}`,
          name: `Time in ${stopName}`,
          category: "Stop",
          summary: `Leave room to look around ${stopName}.`,
          kind: "stop",
          durationMin: 60,
          priceUsd: 0,
          rating: 4.5,
          travelMinFromPrevious: previous ? 30 : 0,
        }),
      );
      return;
    }

    const kind = slot as CatalogPlace["kind"];
    const place = pickPlace(request, kind, purse.remaining, hasMeal, used);
    if (!place) return;
    used.add(place.id);
    purse.remaining -= place.priceUsd;
    if (place.kind === "lunch" || place.kind === "dinner") hasMeal = true;
    const named = withCity(place, request.destination);
    chosen.push(
      blankActivity({
        id: place.id,
        name: named.name,
        category: place.category,
        summary: named.summary,
        kind: place.kind,
        durationMin: place.durationMin,
        priceUsd: place.priceUsd,
        rating: place.rating,
        travelMinFromPrevious: previous ? travelMinutes(previous.kind, place.kind) : 0,
      }),
    );
  });

  return retime(chosen);
}

function pickPlace(
  request: TripRequest,
  kind: CatalogPlace["kind"],
  remainingBudget: number,
  hasMeal: boolean,
  used: Set<string>,
): CatalogPlace | null {
  const pool = available(request, used).filter((place) => place.kind === kind);
  if (pool.length === 0) return null;
  const ranked = rank(request, pool);
  const reserve = kind === "activity" ? mealReserve(request, used, hasMeal) : 0;
  const affordable = ranked.filter((place) => place.priceUsd <= remainingBudget - reserve);
  if (affordable.length > 0) return affordable[0];
  const meal = kind === "lunch" || kind === "dinner";
  if (meal && !hasMeal) {
    return [...ranked].sort((a, b) => a.priceUsd - b.priceUsd || a.id.localeCompare(b.id))[0];
  }
  return ranked.find((place) => place.priceUsd === 0) ?? null;
}

function mealReserve(request: TripRequest, used: Set<string>, hasMeal: boolean) {
  if (hasMeal) return 0;
  const meals = available(request, used).filter((place) => place.kind === "lunch" || place.kind === "dinner");
  if (meals.length === 0) return 0;
  return Math.min(...meals.map((place) => place.priceUsd));
}

function findSwap(
  request: TripRequest,
  activities: Activity[],
  dayIndex: number,
  used: Set<string>,
): SwapOption | null {
  const target = [...activities]
    .filter((activity) => activity.kind !== "stop" && activity.priceUsd > 0)
    .sort((a, b) => b.priceUsd - a.priceUsd)[0];
  if (!target || target.kind === "stop") return null;

  const alternatives = available(request, used)
    .filter((place) => place.kind === target.kind && place.priceUsd < target.priceUsd)
    .sort((a, b) => a.priceUsd - b.priceUsd || b.rating - a.rating);
  const replacement = alternatives[0];
  if (!replacement) return null;
  used.add(replacement.id);
  const named = withCity(replacement, request.destination);

  return {
    dayIndex,
    activityId: target.id,
    replacement: {
      id: replacement.id,
      name: named.name,
      category: replacement.category,
      summary: named.summary,
      kind: replacement.kind,
      durationMin: replacement.durationMin,
      priceUsd: replacement.priceUsd,
      rating: replacement.rating,
    },
  };
}

function available(request: TripRequest, used: Set<string>) {
  return PLACES.filter(
    (place) => !used.has(place.id) && !place.blockedBy.some((need) => request.dietary.includes(need)),
  );
}

function rank(request: TripRequest, places: CatalogPlace[]) {
  return [...places].sort((a, b) => score(request, b) - score(request, a) || a.priceUsd - b.priceUsd || a.id.localeCompare(b.id));
}

function score(request: TripRequest, place: CatalogPlace) {
  let value = place.rating;
  if (place.interests.some((interest) => request.interests.includes(interest))) value += 3;
  if (place.setting === request.preferences.setting) value += 2;
  if (place.crowd === request.preferences.crowd) value += 2;
  if (place.foodStyle && place.foodStyle === request.preferences.food) value += 2;
  if (request.preferences.pace === "packed" && place.durationMin <= 70) value += 1;
  if (request.preferences.pace === "relaxed" && place.durationMin >= 80) value += 1;
  value -= place.priceUsd / 40;
  return value;
}

function travelMinutes(from: ActivityKind, to: ActivityKind) {
  if (from === to) return 12;
  if (from === "stop" || to === "stop") return 30;
  return 18;
}

function retime(activities: Activity[]) {
  let cursor = DAY_START_MIN;
  return activities.map((activity, index) => {
    if (index > 0) cursor += activity.travelMinFromPrevious;
    const start = cursor;
    const end = start + activity.durationMin;
    cursor = end;
    return {
      ...activity,
      startTime: formatMinutes(start),
      endTime: formatMinutes(end),
    };
  });
}

function blankActivity(activity: Omit<Activity, "startTime" | "endTime">): Activity {
  return { ...activity, startTime: "", endTime: "" };
}

function withCity(place: CatalogPlace, destination: string) {
  return {
    name: place.title.replaceAll("{city}", destination),
    summary: place.summary.replaceAll("{city}", destination),
  };
}

function toExtra(place: CatalogPlace, destination: string): ExtraSuggestion {
  const named = withCity(place, destination);
  return {
    id: place.id,
    name: named.name,
    category: place.category,
    summary: named.summary,
    priceUsd: place.priceUsd,
    durationMin: place.durationMin,
    rating: place.rating,
  };
}

function sumPrices(activities: Activity[]) {
  return activities.reduce((sum, activity) => sum + activity.priceUsd, 0);
}

function totalTravel(days: DayPlan[]) {
  return days.reduce(
    (sum, day) => sum + day.activities.reduce((inner, activity) => inner + activity.travelMinFromPrevious, 0),
    0,
  );
}

function datesBetween(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor <= last && dates.length < DAY_LIMIT) {
    dates.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return { dates, truncated: cursor <= last };
}

function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatMinutes(total: number) {
  const minutes = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function itineraryId(request: TripRequest) {
  const raw = JSON.stringify({
    destination: request.destination,
    stops: request.stops,
    startDate: request.startDate,
    endDate: request.endDate,
    budget: request.budget,
    interests: [...request.interests].sort(),
    dietary: [...request.dietary].sort(),
    preferences: request.preferences,
  });
  let hash = 0;
  for (const char of raw) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return `trip-${hash.toString(16)}`;
}

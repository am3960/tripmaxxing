import type { Draft, Itinerary } from "./types";

const DRAFT_KEY = "tripmaxxing.draft";
const CURRENT_KEY = "tripmaxxing.current";
const SAVED_KEY = "tripmaxxing.saved";

export function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : {};
  } catch {
    return {};
  }
}

export function saveDraft(draft: Draft) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadCurrent(): Itinerary | null {
  try {
    const raw = sessionStorage.getItem(CURRENT_KEY);
    return raw ? (JSON.parse(raw) as Itinerary) : null;
  } catch {
    return null;
  }
}

export function saveCurrent(itinerary: Itinerary) {
  sessionStorage.setItem(CURRENT_KEY, JSON.stringify(itinerary));
}

export function loadSaved(): Itinerary[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const parsed = raw ? (JSON.parse(raw) as Itinerary[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTrip(itinerary: Itinerary) {
  const next = [itinerary, ...loadSaved().filter((trip) => trip.id !== itinerary.id)].slice(0, 8);
  localStorage.setItem(SAVED_KEY, JSON.stringify(next));
}

export function removeSaved(id: string) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(loadSaved().filter((trip) => trip.id !== id)));
}

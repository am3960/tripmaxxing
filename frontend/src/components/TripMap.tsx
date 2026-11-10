import { useEffect, useRef, useState } from "react";
import { configureGoogleMaps, drawTripMap, locatePlaces } from "../googleMaps";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";

type Props = {
  places: string[];
};

export default function TripMap({ places }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const placesKey = places.join("\u0000");
  const [status, setStatus] = useState<string | null>(API_KEY ? "Loading the map…" : null);

  useEffect(() => {
    const container = containerRef.current;
    if (!API_KEY || !container) return;
    let active = true;
    configureGoogleMaps(API_KEY);
    window.gm_authFailure = () => {
      if (active) {
        setStatus(
          "Google rejected this Maps key. Enable Maps JavaScript API and Geocoding API, turn on billing, and allow http://localhost:5173/* as a website referrer.",
        );
      }
    };
    setStatus("Loading the map…");

    locatePlaces(placesKey.split("\u0000"))
      .then(async (result) => {
        if (!active) return;
        if (result.found.length === 0) {
          container.replaceChildren();
          setStatus(`Couldn't find ${result.missing.join(", ")} on Google Maps.`);
          return;
        }
        await drawTripMap(container, result.found);
        if (!active) return;
        setStatus(result.missing.length > 0 ? `Couldn't find ${result.missing.join(", ")}.` : null);
      })
      .catch((error: unknown) => {
        if (active) setStatus(mapError(error));
      });

    return () => {
      active = false;
      delete window.gm_authFailure;
    };
  }, [placesKey]);

  if (!API_KEY) {
    return (
      <section className="trip-map">
        <h2>Map</h2>
        <p className="note">
          The itinerary map needs its own Google Maps key. The sign-in client ID cannot load maps. Create an API
          key, enable Maps JavaScript API and Geocoding API, allow http://localhost:5173/* as a referrer, then set
          VITE_GOOGLE_MAPS_API_KEY in the project .env and restart the dev server.
        </p>
      </section>
    );
  }

  return (
    <section className="trip-map">
      <h2>Map</h2>
      <div ref={containerRef} className="trip-map-canvas" role="region" aria-label="Trip map" />
      {status ? <p className="note">{status}</p> : null}
    </section>
  );
}

function mapError(error: unknown) {
  const detail = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!detail) return "Google Maps could not look up this trip.";
  return detail;
}

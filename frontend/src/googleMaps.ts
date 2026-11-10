import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export type MappedPlace = {
  label: string;
  address: string;
  placeId: string;
  location: google.maps.LatLng;
  viewport: google.maps.LatLngBounds;
};

let configured = false;

export function configureGoogleMaps(apiKey: string) {
  if (configured) return;
  setOptions({ key: apiKey, v: "weekly" });
  configured = true;
}

export async function locatePlaces(labels: string[]) {
  const [destination, ...stops] = labels.map((label) => label.trim()).filter(Boolean);
  const found: MappedPlace[] = [];
  const missing: string[] = [];
  if (!destination) return { found, missing };

  const { Geocoder } = await importLibrary("geocoding");
  const geocoder = new Geocoder();
  const destinationHit = await geocode(geocoder, destination);
  if (destinationHit) found.push(toPlace(destination, destinationHit));
  else missing.push(destination);

  const stopHits = await Promise.all(
    stops.map(async (stop) => {
      const hit =
        (await geocode(geocoder, `${stop}, ${destination}`)) ?? (await geocode(geocoder, stop));
      return { stop, hit };
    }),
  );
  for (const { stop, hit } of stopHits) {
    if (hit) found.push(toPlace(stop, hit));
    else missing.push(stop);
  }
  return { found, missing };
}

export async function drawTripMap(container: HTMLElement, places: MappedPlace[]) {
  if (places.length === 0) return;
  const [{ Map, InfoWindow }, { Marker }] = await Promise.all([
    importLibrary("maps"),
    importLibrary("marker"),
  ]);

  container.replaceChildren();
  const map = new Map(container, {
    center: places[0].location,
    zoom: 12,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  });
  const info = new InfoWindow();

  for (const place of places) {
    const marker = new Marker({
      map,
      position: place.location,
      title: place.label,
    });
    marker.addListener("click", () => {
      info.setContent(popup(place));
      info.setOptions({ ariaLabel: place.label });
      info.open({ map, anchor: marker });
    });
  }

  if (places.length === 1) {
    map.fitBounds(places[0].viewport);
    return;
  }
  const { LatLngBounds } = await importLibrary("core");
  const bounds = new LatLngBounds();
  for (const place of places) bounds.extend(place.location);
  map.fitBounds(bounds, 48);
}

async function geocode(geocoder: google.maps.Geocoder, address: string) {
  try {
    const { results } = await geocoder.geocode({ address });
    return results[0] ?? null;
  } catch (error) {
    if (isZeroResults(error)) return null;
    throw error;
  }
}

function toPlace(label: string, result: google.maps.GeocoderResult): MappedPlace {
  return {
    label,
    address: result.formatted_address,
    placeId: result.place_id,
    location: result.geometry.location,
    viewport: result.geometry.viewport,
  };
}

function popup(place: MappedPlace) {
  const content = document.createElement("div");
  content.className = "trip-map-popup";

  const name = document.createElement("strong");
  name.textContent = place.label;

  const address = document.createElement("p");
  address.textContent = place.address;

  const link = document.createElement("a");
  const params = new URLSearchParams({
    api: "1",
    query: place.address || place.label,
    query_place_id: place.placeId,
  });
  link.href = `https://www.google.com/maps/search/?${params.toString()}`;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Open in Google Maps";

  content.append(name, address, link);
  return content;
}

function isZeroResults(error: unknown) {
  if (typeof error === "string") return error === "ZERO_RESULTS";
  return typeof error === "object" && error !== null && "code" in error && error.code === "ZERO_RESULTS";
}

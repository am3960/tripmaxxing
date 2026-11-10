import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadDraft, saveDraft } from "../storage";
import { DIETARY, INTERESTS, type Dietary, type Interest, type TripDetails } from "../types";

function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function emptyDetails(): TripDetails {
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + 2);
  return {
    destination: "",
    stops: [],
    startDate: isoDate(start),
    endDate: isoDate(end),
    budget: 250,
    interests: ["Food"],
    dietary: [],
  };
}

export default function TripForm() {
  const navigate = useNavigate();
  const [details, setDetails] = useState<TripDetails>(() => loadDraft().details ?? emptyDetails());
  const [stopDraft, setStopDraft] = useState("");
  const [error, setError] = useState("");

  function update<K extends keyof TripDetails>(key: K, value: TripDetails[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  function toggleInterest(interest: Interest) {
    setDetails((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }));
  }

  function toggleDietary(need: Dietary) {
    setDetails((current) => ({
      ...current,
      dietary: current.dietary.includes(need)
        ? current.dietary.filter((item) => item !== need)
        : [...current.dietary, need],
    }));
  }

  function addStop() {
    const stop = stopDraft.trim();
    if (!stop) return;
    setDetails((current) => ({ ...current, stops: [...current.stops, stop] }));
    setStopDraft("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const destination = details.destination.trim();
    if (!destination) {
      setError("Add a destination.");
      return;
    }
    if (!details.startDate || !details.endDate || details.endDate < details.startDate) {
      setError("End date has to be on or after the start date.");
      return;
    }
    if (!Number.isFinite(details.budget) || details.budget <= 0) {
      setError("Enter a budget greater than zero.");
      return;
    }

    saveDraft({
      ...loadDraft(),
      details: {
        ...details,
        destination,
        stops: details.stops.map((stop) => stop.trim()).filter(Boolean),
        budget: Math.round(details.budget),
      },
    });
    navigate("/preferences");
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label>
        Destination
        <input
          value={details.destination}
          onChange={(event) => update("destination", event.target.value)}
          placeholder="New York City"
          required
        />
      </label>

      <fieldset>
        <legend>Extra stops</legend>
        <div className="inline">
          <input
            value={stopDraft}
            onChange={(event) => setStopDraft(event.target.value)}
            placeholder="Brooklyn, a museum neighborhood..."
            aria-label="Extra stop"
          />
          <button type="button" className="button secondary" onClick={addStop}>
            Add stop
          </button>
        </div>
        {details.stops.length > 0 && (
          <ul className="stops">
            {details.stops.map((stop, index) => (
              <li key={`${stop}-${index}`}>
                <span>{stop}</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    update(
                      "stops",
                      details.stops.filter((_, stopIndex) => stopIndex !== index),
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <div className="split">
        <label>
          Start
          <input
            type="date"
            value={details.startDate}
            onChange={(event) => update("startDate", event.target.value)}
            required
          />
        </label>
        <label>
          End
          <input
            type="date"
            value={details.endDate}
            min={details.startDate}
            onChange={(event) => update("endDate", event.target.value)}
            required
          />
        </label>
        <label>
          Budget (USD)
          <input
            type="number"
            min={1}
            step={1}
            value={details.budget}
            onChange={(event) => update("budget", Number(event.target.value))}
            required
          />
        </label>
      </div>

      <fieldset>
        <legend>Interests</legend>
        <div className="chips">
          {INTERESTS.map((interest) => (
            <button
              key={interest}
              type="button"
              className={details.interests.includes(interest) ? "chip selected" : "chip"}
              aria-pressed={details.interests.includes(interest)}
              onClick={() => toggleInterest(interest)}
            >
              {interest}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Dietary exclusions</legend>
        <div className="chips">
          {DIETARY.map((need) => (
            <button
              key={need}
              type="button"
              className={details.dietary.includes(need) ? "chip selected" : "chip"}
              aria-pressed={details.dietary.includes(need)}
              onClick={() => toggleDietary(need)}
            >
              {need}
            </button>
          ))}
        </div>
      </fieldset>

      {error && <p className="error">{error}</p>}
      <button className="button" type="submit">
        Continue
      </button>
    </form>
  );
}

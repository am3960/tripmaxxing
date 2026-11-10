import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { planTrip } from "../api/plan";
import { loadDraft, saveCurrent, saveDraft } from "../storage";
import type { Preferences } from "../types";

const PAIRS: {
  key: keyof Preferences;
  prompt: string;
  left: { value: Preferences[keyof Preferences]; label: string };
  right: { value: Preferences[keyof Preferences]; label: string };
}[] = [
  {
    key: "food",
    prompt: "What should meals lean toward?",
    left: { value: "local", label: "Neighborhood meals" },
    right: { value: "iconic", label: "Famous restaurants" },
  },
  {
    key: "pace",
    prompt: "How full should the days be?",
    left: { value: "relaxed", label: "Relaxed" },
    right: { value: "packed", label: "Packed" },
  },
  {
    key: "setting",
    prompt: "Where do you want to spend time?",
    left: { value: "indoors", label: "Mostly indoors" },
    right: { value: "outdoors", label: "Mostly outdoors" },
  },
  {
    key: "crowd",
    prompt: "What kind of places sound better?",
    left: { value: "popular", label: "Popular spots" },
    right: { value: "quiet", label: "Quieter places" },
  },
];

export default function ThisOrThat() {
  const navigate = useNavigate();
  const draft = loadDraft();
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<Partial<Preferences>>(draft.preferences ?? {});
  const [busy, setBusy] = useState(false);

  if (!draft.details) {
    return (
      <p className="lede">
        Add trip details first. <Link to="/plan">Go to the form</Link>
      </p>
    );
  }

  const pair = PAIRS[step];
  const selected = choices[pair.key];

  async function choose(value: Preferences[keyof Preferences]) {
    const next = { ...choices, [pair.key]: value };
    setChoices(next);
    if (step < PAIRS.length - 1) {
      setStep(step + 1);
      return;
    }
    const details = loadDraft().details;
    if (!details) return;
    const preferences = next as Preferences;
    saveDraft({ details, preferences });
    setBusy(true);
    const itinerary = await planTrip({ ...details, preferences });
    saveCurrent(itinerary);
    navigate("/itinerary");
  }

  return (
    <div className="choices">
      <p className="step">
        {step + 1} of {PAIRS.length} · {draft.details.destination}
      </p>
      <h2>{pair.prompt}</h2>
      <div className="pair">
        <button
          type="button"
          className={selected === pair.left.value ? "choice selected" : "choice"}
          disabled={busy}
          onClick={() => choose(pair.left.value)}
        >
          {pair.left.label}
        </button>
        <button
          type="button"
          className={selected === pair.right.value ? "choice selected" : "choice"}
          disabled={busy}
          onClick={() => choose(pair.right.value)}
        >
          {pair.right.label}
        </button>
      </div>
      {step > 0 && (
        <button type="button" className="text-button" onClick={() => setStep(step - 1)}>
          Back
        </button>
      )}
    </div>
  );
}

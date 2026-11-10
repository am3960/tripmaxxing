import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authErrorMessage, GoogleSignInButton, useAuth } from "../auth";
import { formatDate, formatMoney } from "../format";
import { loadSaved, removeSaved, saveCurrent } from "../storage";
import type { Itinerary } from "../types";

export default function Home() {
  const [saved, setSaved] = useState<Itinerary[]>(() => loadSaved());
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const authError = authErrorMessage(params.get("auth_error"));

  return (
    <>
      <section className="panel hero">
        <p className="eyebrow">Discover · Plan · Travel</p>
        <h1>Plan smarter. Travel better.</h1>
        <p className="lede">
          TripMaxxing turns a destination, dates, and a budget into a day-by-day itinerary.
        </p>
        {authError ? <p className="error">{authError}</p> : null}
        <div className="hero-actions">
          {loading ? (
            <p className="note">Checking sign-in…</p>
          ) : user ? (
            <>
              <Link className="button" to="/plan">
                Start planning
              </Link>
              <Link className="button secondary" to="/group">
                Plan a group
              </Link>
              <p className="note signed-in">Signed in as {user.email || user.name}</p>
            </>
          ) : (
            <>
              <GoogleSignInButton className="button">Sign in with Google</GoogleSignInButton>
              <Link className="button secondary" to="/plan">
                Start planning
              </Link>
              <Link className="button secondary" to="/group">
                Plan a group
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="saved">
        <h2>Saved in this browser</h2>
        {saved.length === 0 ? (
          <p className="lede">Trips you save show up here after you generate one.</p>
        ) : (
          <ul className="saved-list">
            {saved.map((trip) => (
              <li key={trip.id} className="saved-card">
                <div>
                  <h3>{trip.destination}</h3>
                  <p>
                    {formatDate(trip.startDate)} – {formatDate(trip.endDate)} · {formatMoney(trip.totalCostUsd)}{" "}
                    estimated
                  </p>
                </div>
                <div className="row-actions">
                  <Link className="button secondary" to="/itinerary" onClick={() => saveCurrent(trip)}>
                    Open
                  </Link>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      removeSaved(trip.id);
                      setSaved(loadSaved());
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

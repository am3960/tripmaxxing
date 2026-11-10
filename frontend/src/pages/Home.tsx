import { Link } from "react-router-dom";

export default function Home() {
  return (
    <section className="panel hero">
      <p className="eyebrow">Discover · Plan · Travel</p>
      <h1>Plan smarter. Travel better.</h1>
      <p className="lede">
        TripMaxxing turns a destination, dates, and a budget into a day-by-day itinerary.
      </p>
      <div className="hero-actions">
        <Link className="button" to="/plan">
          Start planning
        </Link>
        <Link className="button secondary" to="/group">
          Plan a group
        </Link>
      </div>
    </section>
  );
}

import TripForm from "../components/TripForm";

export default function Plan() {
  return (
    <section className="panel">
      <p className="eyebrow">Trip details</p>
      <h1>Where are you going?</h1>
      <p className="lede">Dates, budget, interests, and anything you need to avoid.</p>
      <TripForm />
    </section>
  );
}

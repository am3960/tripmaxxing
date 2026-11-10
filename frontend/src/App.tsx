import { NavLink, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Itinerary from "./pages/Itinerary";
import Plan from "./pages/Plan";
import Preferences from "./pages/Preferences";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          TripMaxxing
        </NavLink>
        <nav className="nav">
          <NavLink to="/plan">Plan</NavLink>
          <NavLink to="/preferences">Preferences</NavLink>
          <NavLink to="/itinerary">Itinerary</NavLink>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/preferences" element={<Preferences />} />
          <Route path="/itinerary" element={<Itinerary />} />
        </Routes>
      </main>
    </div>
  );
}

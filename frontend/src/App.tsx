import { NavLink, Route, Routes } from "react-router-dom";
import { GoogleSignInButton, useAuth } from "./auth";
import Group from "./pages/Group";
import Home from "./pages/Home";
import Itinerary from "./pages/Itinerary";
import Plan from "./pages/Plan";
import Preferences from "./pages/Preferences";

function Account() {
  const { user, loading, logout } = useAuth();
  if (loading) return null;
  if (!user) {
    return <GoogleSignInButton className="button nav-signin">Sign in</GoogleSignInButton>;
  }
  return (
    <div className="account">
      {user.picture ? <img src={user.picture} alt="" /> : null}
      <span>{user.name}</span>
      <button type="button" className="text-button" onClick={() => void logout()}>
        Sign out
      </button>
    </div>
  );
}

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
          <NavLink to="/group">Group</NavLink>
          <Account />
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/preferences" element={<Preferences />} />
          <Route path="/itinerary" element={<Itinerary />} />
          <Route path="/group" element={<Group />} />
          <Route path="/group/:groupId" element={<Group />} />
        </Routes>
      </main>
    </div>
  );
}

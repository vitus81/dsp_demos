import { NavLink, Outlet } from "react-router-dom";

export function App() {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <NavLink to="/" className="brand-link">
          DSP Demo Platform
        </NavLink>
        <span className="top-bar-note">Interactive signal processing labs</span>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

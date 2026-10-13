import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { api, type StaffSession } from "../api/staff";
import { copy } from "../copy";
import { usePreferences } from "../preferences-context";

function navClass(active: boolean): string {
  return [
    "shrink-0 whitespace-nowrap rounded-control border px-3 py-2 text-sm font-medium transition duration-200",
    "hover:-translate-y-0.5 hover:border-accent hover:bg-accent hover:text-on-accent",
    active ? "border-accent bg-accent text-on-accent" : "border-ink bg-card text-ink",
  ].join(" ");
}

export function StaffShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = usePreferences();
  const [session, setSession] = useState<StaffSession | null>(null);

  useEffect(() => {
    void api<StaffSession>("/api/staff/session").then((result) => {
      if (!result.ok) {
        void navigate("/staff/login");
        return;
      }
      setSession(result.data);
    });
  }, [navigate]);

  async function logout() {
    await api("/api/staff/logout", { method: "POST" });
    void navigate("/staff/login");
  }

  if (session === null) {
    return <p className="p-6 text-muted">{copy.loading}</p>;
  }

  const path = location.pathname;
  const links = [
    { to: "/staff", label: copy.yard.board, active: path === "/staff" },
    { to: "/staff/cars", label: copy.cars, active: path.startsWith("/staff/cars") },
    { to: "/staff/rentals", label: copy.yard.rentals, active: path.startsWith("/staff/rentals") },
    { to: "/staff/sales", label: copy.yard.sales, active: path.startsWith("/staff/sales") },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-card">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">{copy.desk}</p>
            <p className="text-sm text-muted">{session.fullName}</p>
          </div>
          <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            {links.map((link) => (
              <Link key={link.to} to={link.to} className={navClass(link.active)}>
                {link.label}
              </Link>
            ))}
            {session.permissions.includes("settings.write") && (
              <Link to="/staff/settings" className={navClass(path.startsWith("/staff/settings"))}>
                {copy.settings}
              </Link>
            )}
            <button
              type="button"
              className={navClass(false)}
              onClick={() => {
                void logout();
              }}
            >
              {copy.logout}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <Outlet key={locale} context={session} />
      </main>
    </div>
  );
}

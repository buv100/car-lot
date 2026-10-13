import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { loadLot, type PublicLot } from "../api/catalog";
import { HomeMenu } from "../components/HomeMenu";
import { copy } from "../copy";
import { usePreferences } from "../preferences-context";

export function PublicShell() {
  const [lot, setLot] = useState<PublicLot | null>(null);

  useEffect(() => {
    void loadLot().then((result) => {
      if (result.ok) setLot(result.data);
    });
  }, []);

  const location = useLocation();
  const { locale } = usePreferences();
  const home = location.pathname === "/";
  const phone = lot?.phone ?? "";
  const address = lot?.address ?? "";

  return (
    <div className="min-h-screen">
      <header className="relative isolate overflow-hidden border-b border-line pt-[env(safe-area-inset-top)]">
        <img
          src="/header-lot.jpg"
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_68%]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-l from-page/90 via-page/55 to-page/35" />
        <HomeMenu lot={lot} />
      </header>
      <main className={home ? undefined : "mx-auto max-w-3xl px-4 py-6"}>
        <Outlet key={locale} />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-6 text-sm text-muted">
          {address.length > 0 && <p>{address}</p>}
          {phone.length > 0 && (
            <a href={`tel:${phone}`} className="text-ink">
              {phone}
            </a>
          )}
          <div className="flex flex-wrap gap-4">
            <Link to="/cancellation" className="text-ink">
              {copy.site.cancellation}
            </Link>
            <Link to="/terms" className="text-ink">
              {copy.site.terms}
            </Link>
            <Link to="/staff/login" className="text-ink">
              {copy.loginTitle}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";

import type { PublicLot } from "../api/catalog";
import { DisplaySettings } from "./DisplaySettings";
import { panelBox } from "./panel-box";
import { copy } from "../copy";

const panelWidth = 260;

/** Same header on every public page: the lot name, and one menu for the whole site. */
export function HomeMenu(props: { lot: PublicLot | null }) {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const name =
    props.lot !== null && props.lot.name.trim().length > 0 ? props.lot.name : copy.site.lotFallback;
  const phone = props.lot?.phone ?? "";
  const email = props.lot?.publicEmail ?? "";

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (navRef.current === null || !(event.target instanceof Node)) return;
      if (!navRef.current.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="relative flex h-14 items-center px-3 sm:px-6">
      <LotLogo name={name} />
      <div
        className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-2 sm:left-6"
        dir="ltr"
      >
        <nav ref={navRef} aria-label={copy.site.homeMenu}>
          <MenuButton
            expanded={open}
            onToggle={() => {
              setOpen((current) => !current);
            }}
            onClose={() => {
              setOpen(false);
            }}
          >
            <MenuGroup title={copy.site.menuPages}>
              <MenuLink to="/" end>
                {copy.site.home}
              </MenuLink>
              <MenuLink to="/rent">{copy.site.rent}</MenuLink>
              <MenuLink to="/buy">{copy.site.buy}</MenuLink>
              <MenuLink to="/buy/all">{copy.site.allCars}</MenuLink>
            </MenuGroup>
            <MenuGroup title={copy.site.personalArea}>
              <MenuLink to="/login" end>
                {copy.site.loginAccount}
              </MenuLink>
              <MenuLink to="/register" end>
                {copy.site.register}
              </MenuLink>
              <MenuLink to="/account" end>
                {copy.site.account}
              </MenuLink>
            </MenuGroup>
            <MenuGroup title={copy.site.contact}>
              {phone.length > 0 && (
                <a href={`tel:${phone}`} className={itemClass(false)}>
                  {copy.phone} · {phone}
                </a>
              )}
              {email.length > 0 && (
                <a href={`mailto:${email}`} className={itemClass(false)}>
                  {copy.email} · {email}
                </a>
              )}
              {phone.length === 0 && email.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted">{copy.site.contactEmpty}</p>
              )}
            </MenuGroup>
            <MenuGroup title={copy.site.menuInfo}>
              <MenuLink to="/cancellation" end>
                {copy.site.cancellation}
              </MenuLink>
              <MenuLink to="/terms" end>
                {copy.site.terms}
              </MenuLink>
              <MenuLink to="/staff/login" end>
                {copy.loginTitle}
              </MenuLink>
            </MenuGroup>
          </MenuButton>
        </nav>
        <DisplaySettings />
      </div>
    </div>
  );
}

function LotLogo(props: { name: string }) {
  return (
    <NavLink
      to="/"
      className="lot-logo absolute right-3 top-1/2 z-10 flex max-w-[calc(100%-8.5rem)] -translate-y-1/2 items-center gap-2 sm:right-6"
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#2F3E34] text-[#FFFBF5] shadow-[0_4px_12px_rgba(47,62,52,0.22)]">
        <span className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-page bg-accent" />
        <CarMark />
      </span>
      <span className="flex min-w-0 flex-col items-start">
        <span className="truncate text-base font-bold leading-none tracking-tight text-ink drop-shadow-sm sm:text-lg">
          {props.name}
        </span>
        <span className="mt-1 h-0.5 w-8 rounded-full bg-accent" aria-hidden="true" />
      </span>
    </NavLink>
  );
}

function CarMark() {
  return (
    <svg viewBox="0 0 72 40" className="h-4 w-6" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 27.5c0-1.6 1-3 2.5-3.5L18 22l5.2-8.2A3.2 3.2 0 0 1 26 12h18.2a3.2 3.2 0 0 1 2.7 1.5L52 22l7.6 2c1.6.4 2.7 1.9 2.7 3.5V32H8v-4.5z"
      />
      <path fill="#2F3E34" d="M28 15.5h15.5l3.2 5.2H24.6l3.4-5.2z" />
      <circle cx="22" cy="31.5" r="3.3" fill="#2F3E34" />
      <circle cx="52" cy="31.5" r="3.3" fill="#2F3E34" />
    </svg>
  );
}

function MenuButton(props: {
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!props.expanded) return;
    function place() {
      const button = buttonRef.current;
      if (button === null) return;
      setPanelStyle(panelBox(button, panelWidth));
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [props.expanded]);

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card/90 text-ink shadow-sm backdrop-blur-sm hover:border-ink/20 hover:bg-page"
        aria-expanded={props.expanded}
        aria-controls={panelId}
        aria-label={props.expanded ? copy.site.menuClose : copy.site.homeMenu}
        onClick={props.onToggle}
      >
        <MenuIcon open={props.expanded} />
      </button>
      {props.expanded &&
        panelStyle !== null &&
        createPortal(
          <div
            id={panelId}
            style={panelStyle}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={props.onClose}
            className="z-30 max-h-[min(70vh,32rem)] overflow-y-auto rounded-card border border-line bg-card p-2 shadow-[0_8px_24px_rgba(47,62,52,0.08)]"
          >
            {props.children}
          </div>,
          document.body,
        )}
    </div>
  );
}

function MenuIcon(props: { open: boolean }) {
  const line = "absolute inset-x-0 h-0.5 rounded-full bg-ink transition duration-200";
  return (
    <span className="relative block h-4 w-5" aria-hidden="true">
      <span className={`${line} ${props.open ? "top-1.5 rotate-45" : "top-0"}`} />
      <span className={`${line} top-1.5 ${props.open ? "opacity-0" : ""}`} />
      <span className={`${line} ${props.open ? "top-1.5 -rotate-45" : "top-3"}`} />
    </span>
  );
}

function MenuGroup(props: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line px-1 py-2 first:border-t-0">
      <p className="px-3 pb-1 text-xs font-medium text-muted">{props.title}</p>
      {props.children}
    </div>
  );
}

function itemClass(active: boolean): string {
  return [
    "block rounded-control px-3 py-2 text-sm font-medium hover:bg-page",
    active ? "bg-page text-accent" : "text-ink",
  ].join(" ");
}

function MenuLink(props: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink to={props.to} end={props.end} className={({ isActive }) => itemClass(isActive)}>
      {props.children}
    </NavLink>
  );
}

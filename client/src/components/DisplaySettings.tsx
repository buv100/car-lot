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

import { copy } from "../copy";
import { textScales } from "../preferences";
import { usePreferences } from "../preferences-context";
import { panelBox } from "./panel-box";

const panelWidth = 280;

/** Display choices beside the site menu: color, text size, and language. */
export function DisplaySettings() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const prefs = usePreferences();

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (rootRef.current === null || !(event.target instanceof Node)) return;
      if (!rootRef.current.contains(event.target)) setOpen(false);
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

  useLayoutEffect(() => {
    if (!open) return;
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
  }, [open]);

  return (
    <div ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card/90 text-ink shadow-sm backdrop-blur-sm hover:border-ink/20 hover:bg-page"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? copy.site.menuClose : copy.settings}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <GearIcon />
      </button>
      {open &&
        panelStyle !== null &&
        createPortal(
          <div
            id={panelId}
            style={panelStyle}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            className="z-30 rounded-card border border-line bg-card p-3 shadow-[0_8px_24px_rgba(47,62,52,0.08)]"
          >
            <p className="px-1 pb-2 text-sm font-bold">{copy.settings}</p>
            <OptionGroup title={copy.site.themeColor}>
              <div className="grid grid-cols-2 gap-1">
                <Option
                  pressed={prefs.theme === "light"}
                  onClick={() => {
                    prefs.setTheme("light");
                  }}
                >
                  {copy.site.themeLight}
                </Option>
                <Option
                  pressed={prefs.theme === "dark"}
                  onClick={() => {
                    prefs.setTheme("dark");
                  }}
                >
                  {copy.site.themeDark}
                </Option>
              </div>
            </OptionGroup>
            <OptionGroup title={copy.site.textSize}>
              <div className="grid grid-cols-4 gap-1">
                {textScales.map((scale) => (
                  <Option
                    key={scale}
                    pressed={prefs.scale === scale}
                    onClick={() => {
                      prefs.setScale(scale);
                    }}
                  >
                    {scale}%
                  </Option>
                ))}
              </div>
            </OptionGroup>
            <OptionGroup title={copy.site.language}>
              <div className="grid grid-cols-2 gap-1">
                <Option
                  pressed={prefs.locale === "he"}
                  onClick={() => {
                    prefs.setLocale("he");
                  }}
                >
                  {copy.site.langHe}
                </Option>
                <Option
                  pressed={prefs.locale === "en"}
                  onClick={() => {
                    prefs.setLocale("en");
                  }}
                >
                  {copy.site.langEn}
                </Option>
              </div>
            </OptionGroup>
          </div>,
          document.body,
        )}
    </div>
  );
}

function OptionGroup(props: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line py-2 first:border-t-0">
      <p className="px-1 pb-1 text-xs font-medium text-muted">{props.title}</p>
      {props.children}
    </div>
  );
}

function Option(props: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={props.pressed}
      className={[
        "rounded-control px-2 py-2 text-sm font-medium",
        props.pressed ? "bg-accent text-on-accent" : "text-ink hover:bg-page",
      ].join(" ")}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6" />
    </svg>
  );
}

import { useEffect, useId, useRef, useState } from "react";

import { copy } from "../copy";
import { getLocale } from "../preferences";
import {
  clockOf,
  dayOf,
  DEFAULT_CLOCK,
  joinMinute,
  monthCells,
  pickRentalDay,
  shorterThanDay,
  todayIso,
} from "../rental-dates";
import { controlClass } from "./control";

function formatDay(day: string): string {
  const month = copy.site.months[Number(day.slice(5, 7)) - 1] ?? "";
  const date = Number(day.slice(8, 10));
  const year = day.slice(0, 4);
  return getLocale() === "he" ? `${date} ב${month} ${year}` : `${date} ${month} ${year}`;
}

function summary(pickup: string, returnAt: string): string {
  const start = dayOf(pickup);
  if (start === "") return copy.site.rentalDatesHint;
  const startText = `${formatDay(start)}, ${clockOf(pickup)}`;
  const end = dayOf(returnAt);
  if (end === "") return `${startText} – ${copy.site.pickReturn}`;
  return `${startText} – ${formatDay(end)}, ${clockOf(returnAt)}`;
}

/** One calendar for both rental days. Times stay in the same panel. */
export function RentalDatesField(props: {
  pickup: string;
  returnAt: string;
  onChange: (pickup: string, returnAt: string) => void;
  error?: string | null;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState("");
  const [pickupClock, setPickupClock] = useState(() => clockOf(props.pickup));
  const [returnClock, setReturnClock] = useState(() => clockOf(props.returnAt));
  const [cursor, setCursor] = useState(() => {
    const day = dayOf(props.pickup);
    if (day !== "") return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 };
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const today = todayIso();
  const pickupDay = dayOf(props.pickup);
  const returnDay = dayOf(props.returnAt);
  const spanEnd = returnDay !== "" ? returnDay : hover > pickupDay ? hover : "";
  const monthName = copy.site.months[cursor.month] ?? "";
  const cells = monthCells(cursor.year, cursor.month);

  function shift(delta: number) {
    const date = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  }

  function choose(day: string) {
    if (day < today) return;
    const next = pickRentalDay(props.pickup, props.returnAt, day, pickupClock, returnClock);
    props.onChange(next.pickup, next.returnAt);
    setCursor({ year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 });
  }

  function changeClock(which: "pickup" | "return", value: string) {
    if (!/^\d{2}:\d{2}$/.test(value)) return;
    if (which === "pickup") {
      setPickupClock(value);
      if (pickupDay !== "") props.onChange(joinMinute(pickupDay, value), props.returnAt);
      return;
    }
    setReturnClock(value);
    if (returnDay !== "") props.onChange(props.pickup, joinMinute(returnDay, value));
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1 text-sm">
      <span className="font-medium" id={`${panelId}-label`}>
        {copy.site.rentalDates}
      </span>
      <button
        type="button"
        aria-labelledby={`${panelId}-label`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-invalid={props.error != null && props.error !== "" ? true : undefined}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={`${controlClass(props.error != null && props.error !== "")} flex items-center justify-between gap-3 text-start`}
      >
        <span className={pickupDay === "" ? "text-muted" : "font-medium"}>
          {summary(props.pickup, props.returnAt)}
        </span>
        <CalendarIcon />
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={copy.site.rentalDates}
          className="absolute inset-x-0 top-full z-20 mt-2 flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-card border border-line bg-card p-4 shadow-lg"
        >
          <div className="grid grid-cols-3 items-center gap-1">
            <button
              type="button"
              aria-label={copy.site.previousMonth}
              onClick={() => {
                shift(-1);
              }}
              className="rounded-control px-1 py-2 text-xs font-medium leading-tight text-ink hover:bg-page"
            >
              {copy.site.previousMonth}
            </button>
            <p className="text-center text-sm font-bold">
              {monthName} {cursor.year}
            </p>
            <button
              type="button"
              aria-label={copy.site.nextMonth}
              onClick={() => {
                shift(1);
              }}
              className="rounded-control px-1 py-2 text-xs font-medium leading-tight text-ink hover:bg-page"
            >
              {copy.site.nextMonth}
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted">
            {copy.site.weekdays.map((weekday, index) => (
              <span key={`${weekday}-${index}`}>{weekday}</span>
            ))}
          </div>
          <div
            className="grid grid-cols-7 gap-y-1"
            onMouseLeave={() => {
              setHover("");
            }}
          >
            {cells.map((cell) => {
              const past = cell.day < today;
              const isStart = cell.day === pickupDay;
              const isEnd = returnDay !== "" && cell.day === returnDay;
              const inside =
                pickupDay !== "" && spanEnd !== "" && cell.day > pickupDay && cell.day < spanEnd;
              const circle = isStart || isEnd ? "bg-accent text-on-accent" : "text-ink";
              return (
                <button
                  key={cell.day}
                  type="button"
                  disabled={past}
                  aria-label={formatDay(cell.day)}
                  aria-pressed={isStart || isEnd}
                  onMouseEnter={() => {
                    setHover(cell.day);
                  }}
                  onClick={() => {
                    choose(cell.day);
                  }}
                  className={`flex h-10 min-w-0 items-center justify-center rounded-full ${inside ? "bg-accent/15" : ""} ${past ? "cursor-not-allowed opacity-40" : "hover:bg-page"}`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm sm:h-9 sm:w-9 ${circle} ${cell.inMonth ? "" : "opacity-50"} ${cell.day === today && !isStart && !isEnd ? "ring-1 ring-accent" : ""}`}
                  >
                    {Number(cell.day.slice(8, 10))}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-muted">{copy.site.rentalDatesHint}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium">{copy.site.pickupTime}</span>
              <input
                type="time"
                value={pickupDay === "" ? DEFAULT_CLOCK : clockOf(props.pickup)}
                onChange={(event) => {
                  changeClock("pickup", event.target.value);
                }}
                className={controlClass()}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">{copy.site.returnClock}</span>
              <input
                type="time"
                value={returnDay === "" ? returnClock : clockOf(props.returnAt)}
                onChange={(event) => {
                  changeClock("return", event.target.value);
                }}
                className={controlClass()}
              />
            </label>
          </div>
          {shorterThanDay(props.pickup, props.returnAt) && (
            <p className="text-danger">{copy.errors.RENTAL_TOO_SHORT}</p>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
            }}
            className="rounded-control bg-accent px-4 py-3 font-medium text-on-accent hover:bg-accent-pressed"
          >
            {copy.site.confirmDates}
          </button>
        </div>
      )}
      {props.error != null && props.error !== "" && (
        <span className="text-danger" role="alert">
          {props.error}
        </span>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-accent" aria-hidden="true">
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

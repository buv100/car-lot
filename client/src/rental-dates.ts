const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^\d{2}:\d{2}$/;

export const DEFAULT_CLOCK = "10:00";

export function dayOf(value: string): string {
  const day = value.slice(0, 10);
  return DAY.test(day) ? day : "";
}

export function clockOf(value: string): string {
  const clock = value.slice(11, 16);
  return CLOCK.test(clock) ? clock : DEFAULT_CLOCK;
}

export function joinMinute(day: string, clock: string): string {
  if (!DAY.test(day)) return "";
  const time = CLOCK.test(clock) ? clock : DEFAULT_CLOCK;
  return `${day}T${time}`;
}

export function todayIso(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * The first click sets pickup. A later day sets return.
 * A day before pickup, or a click after both days are set, starts a new range.
 */
export function pickRentalDay(
  pickup: string,
  returnAt: string,
  day: string,
  pickupClock: string,
  returnClock: string,
): { pickup: string; returnAt: string } {
  if (!DAY.test(day)) return { pickup, returnAt };
  const pickupDay = dayOf(pickup);
  const returnDay = dayOf(returnAt);
  if (pickupDay === "" || returnDay !== "") {
    return { pickup: joinMinute(day, pickupClock), returnAt: "" };
  }
  if (day < pickupDay) return { pickup: joinMinute(day, pickupClock), returnAt: "" };
  return { pickup, returnAt: joinMinute(day, returnClock) };
}

export type MonthCell = { day: string; inMonth: boolean };

/** Six weeks, Sunday first, so the grid does not jump between months. */
export function monthCells(year: number, monthIndex: number): MonthCell[] {
  const leading = new Date(year, monthIndex, 1).getDay();
  const cells: MonthCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(year, monthIndex, index - leading + 1);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    cells.push({
      day: `${date.getFullYear()}-${month}-${day}`,
      inMonth: date.getMonth() === monthIndex,
    });
  }
  return cells;
}

/** Wall-clock hint for the panel. The server still checks the rental length. */
export function shorterThanDay(pickup: string, returnAt: string): boolean {
  if (dayOf(pickup) === "" || dayOf(returnAt) === "") return false;
  const start = new Date(joinMinute(dayOf(pickup), clockOf(pickup)));
  const end = new Date(joinMinute(dayOf(returnAt), clockOf(returnAt)));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return end.getTime() - start.getTime() < 24 * 60 * 60 * 1000;
}

/** Displays stored agorot. Whole shekels hide the agora part. The amount comes from the server. */
export function formatShekels(agorotAmount: number): string {
  const whole = agorotAmount % 100 === 0;
  const formatted = new Intl.NumberFormat("he-IL", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(agorotAmount / 100);
  return `₪${formatted}`;
}

/** Kilometres with a thousands separator. The unit word stays in the Hebrew copy. */
export function formatKm(km: number): string {
  return new Intl.NumberFormat("he-IL").format(km);
}

/** Hours on a price line. A whole day stays a whole number. */
export function formatHours(hours: number): string {
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 }).format(hours);
}

/** Shows an instant as a Jerusalem wall time. */
export function formatJerusalem(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Yearly order numbers stay five digits, `R-YYYY-#####` or `S-YYYY-#####`. */
export function formatOrderNumber(kind: "R" | "S", year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error("Order year is out of range");
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99999) {
    throw new Error("Order sequence is out of range");
  }
  return `${kind}-${String(year)}-${String(sequence).padStart(5, "0")}`;
}

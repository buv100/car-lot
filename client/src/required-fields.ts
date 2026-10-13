import { copy } from "./copy";

export type FieldIssue = "missing" | "invalid";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Israeli mobile, including separators and a +972 prefix. */
export function israeliMobile(input: string): boolean {
  const compact = input.replace(/[^\d+]/g, "");
  let national = compact;
  if (national.startsWith("+972")) national = `0${national.slice(4)}`;
  else if (national.startsWith("972")) national = `0${national.slice(3)}`;
  return /^05\d{8}$/.test(national);
}

/** At least 8 characters, one letter, and one digit. */
export function passwordAccepted(password: string): boolean {
  return password.length >= 8 && /\p{L}/u.test(password) && /\d/u.test(password);
}

/** Jerusalem calendar day, `YYYY-MM-DD`. */
export function jerusalemToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function emailAccepted(input: string): boolean {
  const email = input.trim().toLowerCase();
  return email.length >= 3 && email.length <= 200 && EMAIL.test(email);
}

function nameAccepted(input: string): boolean {
  const name = input.trim();
  return name.length >= 2 && name.length <= 80;
}

function birthAccepted(value: string, today: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > last) return false;
  return value <= today;
}

export type AccountIssues = { missing: string[]; invalid: string[] };

/**
 * Account fields for a new customer, or email and password for an existing one.
 * A filled phone or password that breaks the rule is invalid, not missing.
 */
export function accountIssues(input: {
  creating: boolean;
  fullName: string;
  phone: string;
  birthDate: string;
  email: string;
  password: string;
  today?: string;
}): AccountIssues {
  const today = input.today ?? jerusalemToday();
  const missing: string[] = [];
  const invalid: string[] = [];
  function check(label: string, value: string, accepted: (value: string) => boolean) {
    if (value.trim() === "") missing.push(label);
    else if (!accepted(value)) invalid.push(label);
  }
  if (input.creating) {
    check(copy.site.fullName, input.fullName, nameAccepted);
    check(copy.site.phone, input.phone, israeliMobile);
    check(copy.site.birthDate, input.birthDate, (value) => birthAccepted(value, today));
  }
  check(copy.email, input.email, emailAccepted);
  if (input.creating) check(copy.password, input.password, passwordAccepted);
  else if (input.password === "") missing.push(copy.password);
  return { missing, invalid };
}

/** The phone and password rule, when one of those fields was filled incorrectly. */
export function accountFormatHint(issues: AccountIssues): string[] {
  if (issues.invalid.includes(copy.site.phone) || issues.invalid.includes(copy.password)) {
    return [copy.site.registerHint];
  }
  return [];
}

/** Labels of fields the user left empty. */
export function blankLabels(fields: readonly { label: string; value: string }[]): string[] {
  const labels: string[] = [];
  for (const field of fields) {
    if (field.value.trim() === "") labels.push(field.label);
  }
  return labels;
}

/** A whole number, or a missing/invalid mark. An optional empty value is fine. */
export function wholeNumberIssue(value: string, required: boolean): FieldIssue | null {
  const text = value.trim();
  if (text === "") return required ? "missing" : null;
  if (!/^\d+$/.test(text)) return "invalid";
  return null;
}

export function listedMissing(labels: readonly string[]): string {
  const unique: string[] = [];
  for (const label of labels) {
    if (!unique.includes(label)) unique.push(label);
  }
  return `${copy.missingPrefix}: ${unique.join(", ")}`;
}

export function invalidField(label: string): string {
  return copy.invalidValue.replaceAll("{label}", label);
}

/** One sentence for the top of a form, and null when nothing is wrong. */
export function problemText(
  missing: readonly string[],
  invalid: readonly string[] = [],
  extra: readonly string[] = [],
): string | null {
  const parts: string[] = [];
  if (missing.length > 0) parts.push(listedMissing(missing));
  for (const label of invalid) parts.push(invalidField(label));
  for (const line of extra) parts.push(line);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The message under one field. */
export function fieldMark(
  label: string,
  missing: readonly string[],
  invalid: readonly string[] = [],
): string | null {
  if (missing.includes(label)) return listedMissing([label]);
  if (invalid.includes(label)) return invalidField(label);
  return null;
}

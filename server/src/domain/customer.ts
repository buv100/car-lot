/** Israeli mobile numbers are stored as +972 and nine national digits. */
export function normalizePhone(input: string): string | null {
  const compact = input.replace(/[^\d+]/g, "");
  let national = compact;
  if (national.startsWith("+972")) national = `0${national.slice(4)}`;
  else if (national.startsWith("972")) national = `0${national.slice(3)}`;
  if (!/^05\d{8}$/.test(national)) return null;
  return `+972${national.slice(1)}`;
}

/** A display name is required, and it stays within the account field limit. */
export function normalizeFullName(input: string): string | null {
  const name = input.trim();
  if (name.length < 2 || name.length > 80) return null;
  return name;
}

/** Email is stored in lowercase so uniqueness does not depend on letter case. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (email.length < 3 || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

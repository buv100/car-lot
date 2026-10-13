/** At least 8 characters, one letter, and one digit. The same rule covers staff and customers. */
export function isAcceptedPassword(password: string): boolean {
  return password.length >= 8 && /\p{L}/u.test(password) && /\d/u.test(password);
}

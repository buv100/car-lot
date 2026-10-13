const prefix = "car-lot-hold:";

/** The raw hold token stays in session storage. The JWT stays in the cookie. */
export function saveHold(orderId: string, token: string): void {
  sessionStorage.setItem(`${prefix}${orderId}`, token);
}

export function readHold(orderId: string): string | null {
  return sessionStorage.getItem(`${prefix}${orderId}`);
}

export function holdHeaders(orderId: string): HeadersInit {
  const token = readHold(orderId);
  return token === null ? {} : { "X-Hold-Token": token };
}

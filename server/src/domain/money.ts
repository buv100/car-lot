/** Whole shekels stored as integer agorot, so money never uses floats. */
export type Agorot = number & { readonly __brand: "Agorot" };

/** Turns a whole shekel amount from a form into agorot. */
export function agorot(wholeShekels: number): Agorot {
  if (!Number.isInteger(wholeShekels) || wholeShekels < 0) {
    throw new Error("Shekel input must be a non-negative integer");
  }
  // The brand exists only for the type checker. The value was checked above.
  return (wholeShekels * 100) as Agorot;
}

/** Money already stored as agorot. Rejects a corrupt row instead of branding it quietly. */
export function storedAgorot(value: number): Agorot {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Stored money must be a non-negative integer");
  }
  // The brand is a type-level mark. The integer check above is the real guard.
  return value as Agorot;
}

/** Rounds a computed amount to the nearest agora. Half an agora rounds up. */
export function agorotFromRounded(value: number): Agorot {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Amount must be a non-negative finite number");
  }
  // Same brand boundary for a computed amount that is already in agorot.
  return Math.round(value) as Agorot;
}

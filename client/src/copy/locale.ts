import { en, enCancellationNotes, enCancellationRows, enTermsParagraphs } from "./en";
import { cancellationNotes, cancellationRows, he, termsParagraphs, type Messages } from "./he";
import { getLocale } from "../preferences";

function isMessageKey(property: string): property is keyof Messages {
  return Object.prototype.hasOwnProperty.call(he, property);
}

export function getMessages(): Messages {
  return getLocale() === "en" ? en : he;
}

/** Live view of the active language. Readers pick up a change on the next render. */
export const copy: Messages = new Proxy(he, {
  get(_target, property) {
    if (typeof property !== "string" || !isMessageKey(property)) return undefined;
    return getMessages()[property];
  },
});

export function errorText(code: string): string {
  const errors = getMessages().errors;
  if (isErrorCode(code)) return errors[code];
  return errors.INTERNAL;
}

function isErrorCode(code: string): code is keyof Messages["errors"] {
  return Object.prototype.hasOwnProperty.call(he.errors, code);
}

export function activeCancellationRows(): typeof cancellationRows | typeof enCancellationRows {
  return getLocale() === "en" ? enCancellationRows : cancellationRows;
}

export function activeCancellationNotes(): typeof cancellationNotes | typeof enCancellationNotes {
  return getLocale() === "en" ? enCancellationNotes : cancellationNotes;
}

export function activeTerms(): typeof termsParagraphs | typeof enTermsParagraphs {
  return getLocale() === "en" ? enTermsParagraphs : termsParagraphs;
}

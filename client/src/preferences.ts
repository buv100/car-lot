export const themeKey = "lot-theme";
export const scaleKey = "lot-text-scale";
export const localeKey = "lot-locale";

export const textScales = ["100", "110", "120", "130"] as const;

export type Theme = "light" | "dark";
export type TextScale = (typeof textScales)[number];
export type Locale = "he" | "en";

export type Preferences = {
  theme: Theme;
  scale: TextScale;
  locale: Locale;
};

const defaults: Preferences = { theme: "light", scale: "100", locale: "he" };

function readTheme(value: string | null): Theme {
  return value === "dark" ? "dark" : "light";
}

function readScale(value: string | null): TextScale {
  if (value === "110" || value === "120" || value === "130") return value;
  return "100";
}

function readLocale(value: string | null): Locale {
  return value === "en" ? "en" : "he";
}

function readStored(): Preferences {
  if (typeof localStorage === "undefined") return defaults;
  try {
    return {
      theme: readTheme(localStorage.getItem(themeKey)),
      scale: readScale(localStorage.getItem(scaleKey)),
      locale: readLocale(localStorage.getItem(localeKey)),
    };
  } catch {
    return defaults;
  }
}

let current = readStored();

export function getLocale(): Locale {
  return current.locale;
}

export function getPreferences(): Preferences {
  return current;
}

/** Writes the choice onto the document and keeps it for the next visit. */
export function savePreferences(partial: Partial<Preferences>): Preferences {
  current = { ...current, ...partial };
  applyPreferences(current);
  if (typeof localStorage === "undefined") return current;
  try {
    localStorage.setItem(themeKey, current.theme);
    localStorage.setItem(scaleKey, current.scale);
    localStorage.setItem(localeKey, current.locale);
  } catch {
    return current;
  }
  return current;
}

export function applyPreferences(prefs: Preferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  if (prefs.scale === "100") delete root.dataset.textScale;
  else root.dataset.textScale = prefs.scale;
  root.lang = prefs.locale === "en" ? "en" : "he";
  root.dir = prefs.locale === "en" ? "ltr" : "rtl";
  document.title = prefs.locale === "en" ? "Car lot" : "מגרש רכב";
}

import { createContext, useContext } from "react";

import {
  getPreferences,
  savePreferences,
  type Locale,
  type Preferences,
  type TextScale,
  type Theme,
} from "./preferences";

export type PreferencesApi = Preferences & {
  setTheme: (theme: Theme) => void;
  setScale: (scale: TextScale) => void;
  setLocale: (locale: Locale) => void;
};

const fallback: PreferencesApi = {
  ...getPreferences(),
  setTheme(theme) {
    savePreferences({ theme });
  },
  setScale(scale) {
    savePreferences({ scale });
  },
  setLocale(locale) {
    savePreferences({ locale });
  },
};

export const PreferencesContext = createContext<PreferencesApi>(fallback);

export function usePreferences(): PreferencesApi {
  return useContext(PreferencesContext);
}

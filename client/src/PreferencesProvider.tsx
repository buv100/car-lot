import { useEffect, useState, type ReactNode } from "react";

import { PreferencesContext, type PreferencesApi } from "./preferences-context";
import { applyPreferences, getPreferences, savePreferences, type Preferences } from "./preferences";

export function PreferencesProvider(props: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(getPreferences);

  useEffect(() => {
    applyPreferences(prefs);
  }, [prefs]);

  const api: PreferencesApi = {
    ...prefs,
    setTheme(theme) {
      setPrefs(savePreferences({ theme }));
    },
    setScale(scale) {
      setPrefs(savePreferences({ scale }));
    },
    setLocale(locale) {
      setPrefs(savePreferences({ locale }));
    },
  };

  return <PreferencesContext.Provider value={api}>{props.children}</PreferencesContext.Provider>;
}

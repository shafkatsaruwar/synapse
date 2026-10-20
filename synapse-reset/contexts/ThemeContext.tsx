import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Theme {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHover: string;
  heroCardBackground: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  tint: string;
  tintLight: string;
  accent: string;
  accentLight: string;
  green: string;
  greenLight: string;
  orange: string;
  orangeLight: string;
  red: string;
  redLight: string;
  yellow: string;
  yellowLight: string;
  cyan: string;
  cyanLight: string;
  pink: string;
  pinkLight: string;
  purple: string;
  purpleLight: string;
  tabIconDefault: string;
  tabIconSelected: string;
  sidebar: string;
  sidebarActive: string;
  sidebarHover: string;
}

/** Effective theme used for styling. */
export type ThemeId = "calm" | "light" | "dark" | "evergreen" | "evergreenDark";
/**
 * User preference in Settings.
 * "evergreen" follows device light/dark with Soft Evergreen palettes.
 * Existing saved preferences are never overwritten on upgrade.
 */
export type ThemePreference = "system" | "calm" | "light" | "dark" | "evergreen";

const THEME_STORAGE_KEY = "app_theme";
/** Soft Evergreen for first launch only (no saved preference). */
const DEFAULT_PREFERENCE: ThemePreference = "evergreen";

const SAVED_PREFERENCES = new Set<string>(["system", "calm", "light", "dark", "evergreen"]);

interface ThemeContextValue {
  themeId: ThemeId;
  preference: ThemePreference;
  setThemeId: (id: ThemePreference) => Promise<void>;
  colors: Theme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getThemeColors(id: ThemeId): Theme {
  switch (id) {
    case "light":
      return require("@/themes/light").default;
    case "dark":
      return require("@/themes/dark").default;
    case "evergreen":
      return require("@/themes/evergreen").default;
    case "evergreenDark":
      return require("@/themes/evergreen-dark").default;
    default:
      return require("@/themes/calm").default;
  }
}

function preferenceToThemeId(preference: ThemePreference, colorScheme: string | null): ThemeId {
  if (preference === "system") {
    return colorScheme === "dark" ? "dark" : "light";
  }
  if (preference === "evergreen") {
    return colorScheme === "dark" ? "evergreenDark" : "evergreen";
  }
  return preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>(DEFAULT_PREFERENCE);
  const themeId = useMemo(
    () => preferenceToThemeId(preference, colorScheme ?? null),
    [preference, colorScheme]
  );
  const colors = useMemo(() => getThemeColors(themeId), [themeId]);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved && SAVED_PREFERENCES.has(saved)) {
          setPreference(saved as ThemePreference);
          return;
        }
        // First launch: persist Soft Evergreen as the chosen default.
        setPreference("evergreen");
        return AsyncStorage.setItem(THEME_STORAGE_KEY, "evergreen");
      })
      .catch(() => {});
  }, []);

  const setThemeId = useCallback(async (id: ThemePreference) => {
    setPreference(id);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ themeId, preference, setThemeId, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const evergreen = require("@/themes/evergreen").default as Theme;
    return {
      themeId: "evergreen",
      preference: "evergreen",
      setThemeId: async () => {},
      colors: evergreen,
    };
  }
  return ctx;
}

export function isEvergreenTheme(themeId: ThemeId): boolean {
  return themeId === "evergreen" || themeId === "evergreenDark";
}

export function isDarkAppearance(themeId: ThemeId): boolean {
  return themeId === "dark" || themeId === "evergreenDark";
}

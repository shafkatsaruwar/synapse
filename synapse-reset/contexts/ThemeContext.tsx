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

export type ThemeId = "calm" | "light" | "dark";
/** User preference: system = follow device appearance; otherwise use that theme. */
export type ThemePreference = "system" | ThemeId;

const THEME_STORAGE_KEY = "app_theme";
const DEFAULT_PREFERENCE: ThemePreference = "system";

interface ThemeContextValue {
  /** Effective theme used for styling (calm | light | dark). */
  themeId: ThemeId;
  /** User preference: "system" or a fixed theme. Used for Settings selection. */
  preference: ThemePreference;
  setThemeId: (id: ThemePreference) => Promise<void>;
  colors: Theme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getThemeColors(id: ThemeId): Theme {
  // Lazy import to avoid circular deps with theme files importing Theme type
  switch (id) {
    case "light":
      return require("@/themes/light").default;
    case "dark":
      return require("@/themes/dark").default;
    default:
      return require("@/themes/calm").default;
  }
}

function preferenceToThemeId(preference: ThemePreference, colorScheme: string | null): ThemeId {
  if (preference === "system") {
    return colorScheme === "dark" ? "dark" : "light";
  }
  return preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>(DEFAULT_PREFERENCE);
  const themeId = useMemo(
    () => preferenceToThemeId(preference, colorScheme),
    [preference, colorScheme]
  );
  const colors = useMemo(() => getThemeColors(themeId), [themeId]);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === "system" || saved === "calm" || saved === "light" || saved === "dark") {
        setPreference(saved as ThemePreference);
      }
    }).catch(() => {});
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
    // Fallback: return calm theme so components work outside provider
    const calm = require("@/themes/calm").default as Theme;
    return {
      themeId: "calm",
      preference: "system",
      setThemeId: async () => {},
      colors: calm,
    };
  }
  return ctx;
}

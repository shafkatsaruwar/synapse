import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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

const THEME_STORAGE_KEY = "app_theme";
const DEFAULT_THEME: ThemeId = "calm";

interface ThemeContextValue {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => Promise<void>;
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);
  const [colors, setColors] = useState<Theme>(() => getThemeColors(DEFAULT_THEME));

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === "calm" || saved === "light" || saved === "dark") {
        setThemeIdState(saved);
        setColors(getThemeColors(saved));
      }
    }).catch(() => {});
  }, []);

  const setThemeId = useCallback(async (id: ThemeId) => {
    setThemeIdState(id);
    setColors(getThemeColors(id));
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, colors }}>
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
      setThemeId: async () => {},
      colors: calm,
    };
  }
  return ctx;
}

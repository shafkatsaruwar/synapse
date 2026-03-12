import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import calm from "@/themes/calm";
import light from "@/themes/light";
import dark from "@/themes/dark";

export type ThemeId = "calm" | "light" | "dark";

export type AppTheme = typeof calm;

const THEME_KEY = "app_theme";

const THEMES: Record<ThemeId, AppTheme> = { calm, light, dark };

interface ThemeContextValue {
  theme: AppTheme;
  themeId: ThemeId;
  setTheme: (id: ThemeId) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: calm,
  themeId: "calm",
  setTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>("calm");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((stored) => {
        if (stored === "calm" || stored === "light" || stored === "dark") {
          setThemeId(stored);
        }
      })
      .catch(() => {});
  }, []);

  const setTheme = useCallback(async (id: ThemeId) => {
    setThemeId(id);
    try {
      await AsyncStorage.setItem(THEME_KEY, id);
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeId], themeId, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

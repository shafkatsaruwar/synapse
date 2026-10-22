import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { AccessibilityInfo, Appearance, useColorScheme } from "react-native";
import { DEFAULT_APPEARANCE } from "@/lib/appearance/defaults";
import { applyAppearanceToTheme, effectiveSurfaceStyle } from "@/lib/appearance/resolve";
import { loadAppearance, loadSavedLooks, saveAppearance, saveSavedLooks } from "@/lib/appearance/storage";
import type {
  AppearanceConfig,
  AppearanceThemePreference,
  SavedLook,
  SurfaceStyleId,
} from "@/lib/appearance/types";

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
export type ThemeId = "calm" | "light" | "dark" | "evergreen" | "evergreenDark" | "blue";
/**
 * User preference in Settings / Appearance Studio.
 * "evergreen" follows device light/dark with Soft Evergreen palettes.
 * Existing saved preferences are never overwritten on upgrade.
 */
export type ThemePreference = AppearanceThemePreference;

const DEFAULT_PREFERENCE: ThemePreference = "evergreen";

interface ThemeContextValue {
  themeId: ThemeId;
  preference: ThemePreference;
  /** @deprecated Prefer commitAppearance / updateAppearance — kept for existing callers. */
  setThemeId: (id: ThemePreference) => Promise<void>;
  colors: Theme;
  /** Committed appearance (persisted). */
  appearance: AppearanceConfig;
  /** Live draft while editing in Appearance Studio (null outside studio). */
  draftAppearance: AppearanceConfig | null;
  surfaceStyle: SurfaceStyleId;
  reduceMotion: boolean;
  savedLooks: SavedLook[];
  beginAppearanceDraft: () => void;
  updateAppearanceDraft: (partial: Partial<AppearanceConfig>) => void;
  cancelAppearanceDraft: () => void;
  commitAppearance: () => Promise<void>;
  resetAppearance: () => Promise<void>;
  applySavedLook: (look: SavedLook) => void;
  saveCurrentLook: (name: string) => Promise<void>;
  deleteSavedLook: (id: string) => Promise<void>;
  renameSavedLook: (id: string, name: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function getThemeColors(id: ThemeId): Theme {
  switch (id) {
    case "light":
      return require("@/themes/light").default;
    case "dark":
      return require("@/themes/dark").default;
    case "evergreen":
      return require("@/themes/evergreen").default;
    case "evergreenDark":
      return require("@/themes/evergreen-dark").default;
    case "blue":
      return require("@/themes/blue").default;
    default:
      return require("@/themes/calm").default;
  }
}

export function preferenceToThemeId(preference: ThemePreference, colorScheme: string | null): ThemeId {
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
  const [appearance, setAppearance] = useState<AppearanceConfig>(DEFAULT_APPEARANCE);
  const [draftAppearance, setDraftAppearance] = useState<AppearanceConfig | null>(null);
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);
  const [systemReduceTransparency, setSystemReduceTransparency] = useState(false);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  const active = draftAppearance ?? appearance;
  const preference = active.theme;
  const themeId = useMemo(
    () => preferenceToThemeId(preference, colorScheme ?? null),
    [preference, colorScheme],
  );

  const colors = useMemo(() => {
    const base = getThemeColors(themeId);
    return applyAppearanceToTheme(base, active, themeId, systemReduceTransparency);
  }, [themeId, active, systemReduceTransparency]);

  const surfaceStyle = useMemo(
    () => effectiveSurfaceStyle(active, systemReduceTransparency),
    [active, systemReduceTransparency],
  );

  const reduceMotion = active.reduceMotion || systemReduceMotion;

  useEffect(() => {
    let mounted = true;
    Promise.all([loadAppearance(), loadSavedLooks()])
      .then(([cfg, looks]) => {
        if (!mounted) return;
        setAppearance(cfg);
        setSavedLooks(looks);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Keep the native color scheme aligned with the chosen appearance so BlurView,
   * status bar, and system chrome follow Dark / Light instead of only the device setting.
   * System + Evergreen still track the device so their light/dark variants can flip.
   */
  useEffect(() => {
    if (preference === "system" || preference === "evergreen") {
      Appearance.setColorScheme(null);
      return;
    }
    Appearance.setColorScheme(themeId === "dark" || themeId === "evergreenDark" ? "dark" : "light");
  }, [preference, themeId]);

  useEffect(() => {
    const sync = () => {
      AccessibilityInfo.isReduceTransparencyEnabled?.()
        .then((v) => setSystemReduceTransparency(!!v))
        .catch(() => {});
      AccessibilityInfo.isReduceMotionEnabled?.()
        .then((v) => setSystemReduceMotion(!!v))
        .catch(() => {});
    };
    sync();
    const subs: { remove?: () => void }[] = [];
    try {
      const t = AccessibilityInfo.addEventListener("reduceTransparencyChanged", (v) =>
        setSystemReduceTransparency(!!v),
      );
      if (t) subs.push(t);
    } catch {
      /* optional API */
    }
    try {
      const m = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
        setSystemReduceMotion(!!v),
      );
      if (m) subs.push(m);
    } catch {
      /* optional API */
    }
    return () => {
      subs.forEach((s) => s.remove?.());
    };
  }, []);

  const setThemeId = useCallback(async (id: ThemePreference) => {
    setAppearance((prev) => {
      const next = { ...prev, theme: id };
      void saveAppearance(next);
      return next;
    });
    setDraftAppearance((draft) => (draft ? { ...draft, theme: id } : draft));
  }, []);

  const beginAppearanceDraft = useCallback(() => {
    setDraftAppearance({ ...appearance });
  }, [appearance]);

  const updateAppearanceDraft = useCallback((partial: Partial<AppearanceConfig>) => {
    setDraftAppearance((draft) => ({ ...(draft ?? appearance), ...partial }));
  }, [appearance]);

  const cancelAppearanceDraft = useCallback(() => {
    setDraftAppearance(null);
  }, []);

  const commitAppearance = useCallback(async () => {
    const next = draftAppearance ?? appearance;
    setAppearance(next);
    setDraftAppearance(null);
    await saveAppearance(next);
  }, [draftAppearance, appearance]);

  const resetAppearance = useCallback(async () => {
    const next = { ...DEFAULT_APPEARANCE };
    setAppearance(next);
    setDraftAppearance(null);
    await saveAppearance(next);
  }, []);

  const applySavedLook = useCallback((look: SavedLook) => {
    setDraftAppearance((draft) => ({
      ...(draft ?? appearance),
      ...look.config,
    }));
  }, [appearance]);

  const saveCurrentLook = useCallback(async (name: string) => {
    const source = draftAppearance ?? appearance;
    const look: SavedLook = {
      id: `look_${Date.now().toString(36)}`,
      name: name.trim() || "My Look",
      createdAt: new Date().toISOString(),
      config: {
        theme: source.theme,
        accent: source.accent,
        wallpaper: source.wallpaper,
        customWallpaperUri: source.customWallpaperUri ?? null,
        wallpaperBrightness: source.wallpaperBrightness,
        surfaceStyle: source.surfaceStyle,
      },
    };
    const next = [look, ...savedLooks].slice(0, 24);
    setSavedLooks(next);
    await saveSavedLooks(next);
  }, [draftAppearance, appearance, savedLooks]);

  const deleteSavedLook = useCallback(async (id: string) => {
    const next = savedLooks.filter((l) => l.id !== id);
    setSavedLooks(next);
    await saveSavedLooks(next);
  }, [savedLooks]);

  const renameSavedLook = useCallback(async (id: string, name: string) => {
    const next = savedLooks.map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l));
    setSavedLooks(next);
    await saveSavedLooks(next);
  }, [savedLooks]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      preference,
      setThemeId,
      colors,
      appearance,
      draftAppearance,
      surfaceStyle,
      reduceMotion,
      savedLooks,
      beginAppearanceDraft,
      updateAppearanceDraft,
      cancelAppearanceDraft,
      commitAppearance,
      resetAppearance,
      applySavedLook,
      saveCurrentLook,
      deleteSavedLook,
      renameSavedLook,
    }),
    [
      themeId,
      preference,
      setThemeId,
      colors,
      appearance,
      draftAppearance,
      surfaceStyle,
      reduceMotion,
      savedLooks,
      beginAppearanceDraft,
      updateAppearanceDraft,
      cancelAppearanceDraft,
      commitAppearance,
      resetAppearance,
      applySavedLook,
      saveCurrentLook,
      deleteSavedLook,
      renameSavedLook,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const evergreen = require("@/themes/evergreen").default as Theme;
    const noop = async () => {};
    return {
      themeId: "evergreen",
      preference: DEFAULT_PREFERENCE,
      setThemeId: noop,
      colors: evergreen,
      appearance: DEFAULT_APPEARANCE,
      draftAppearance: null,
      surfaceStyle: "soft",
      reduceMotion: false,
      savedLooks: [],
      beginAppearanceDraft: () => {},
      updateAppearanceDraft: () => {},
      cancelAppearanceDraft: () => {},
      commitAppearance: noop,
      resetAppearance: noop,
      applySavedLook: () => {},
      saveCurrentLook: noop,
      deleteSavedLook: noop,
      renameSavedLook: noop,
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

export function isBlueTheme(themeId: ThemeId): boolean {
  return themeId === "blue";
}

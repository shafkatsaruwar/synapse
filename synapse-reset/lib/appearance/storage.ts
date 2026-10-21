import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_APPEARANCE } from "@/lib/appearance/defaults";
import {
  APPEARANCE_STORAGE_KEY,
  SAVED_LOOKS_STORAGE_KEY,
  type AppearanceConfig,
  type AppearanceThemePreference,
  type AccentId,
  type SavedLook,
  type SurfaceStyleId,
  type WallpaperId,
} from "@/lib/appearance/types";

const THEME_LEGACY_KEY = "app_theme";

const THEMES = new Set<AppearanceThemePreference>(["system", "calm", "light", "dark", "evergreen", "blue"]);
const ACCENTS = new Set<AccentId>(["burgundy", "evergreen", "blue", "violet", "rose", "amber", "teal", "slate"]);
const WALLPAPERS = new Set<WallpaperId>([
  "none",
  "mist",
  "linen",
  "cloud",
  "softGradient",
  "aurora",
  "meadow",
  "ocean",
  "dusk",
  "custom",
]);
const SURFACES = new Set<SurfaceStyleId>(["solid", "soft", "glass"]);

function clampBrightness(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return DEFAULT_APPEARANCE.wallpaperBrightness;
  return Math.min(1, Math.max(0.35, v));
}

export function sanitizeAppearance(raw: Partial<AppearanceConfig> | null | undefined): AppearanceConfig {
  const base = { ...DEFAULT_APPEARANCE, ...(raw ?? {}) };
  return {
    theme: THEMES.has(base.theme) ? base.theme : DEFAULT_APPEARANCE.theme,
    accent: ACCENTS.has(base.accent) ? base.accent : DEFAULT_APPEARANCE.accent,
    wallpaper: WALLPAPERS.has(base.wallpaper) ? base.wallpaper : DEFAULT_APPEARANCE.wallpaper,
    customWallpaperUri: typeof base.customWallpaperUri === "string" ? base.customWallpaperUri : null,
    wallpaperBrightness: clampBrightness(base.wallpaperBrightness),
    surfaceStyle: SURFACES.has(base.surfaceStyle) ? base.surfaceStyle : DEFAULT_APPEARANCE.surfaceStyle,
    reduceTransparency: !!base.reduceTransparency,
    reduceMotion: !!base.reduceMotion,
    increasedContrast: !!base.increasedContrast,
    widgetAppearance:
      base.widgetAppearance === "light" || base.widgetAppearance === "dark" || base.widgetAppearance === "system"
        ? base.widgetAppearance
        : base.widgetAppearance === "calm"
          ? "system"
          : "system",
  };
}

/** Migrate legacy `app_theme` into the appearance blob on first load. */
export async function loadAppearance(): Promise<AppearanceConfig> {
  try {
    const raw = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (raw) {
      return sanitizeAppearance(JSON.parse(raw) as Partial<AppearanceConfig>);
    }
    const legacy = await AsyncStorage.getItem(THEME_LEGACY_KEY);
    if (legacy && THEMES.has(legacy as AppearanceThemePreference)) {
      const migrated = sanitizeAppearance({
        ...DEFAULT_APPEARANCE,
        theme: legacy as AppearanceThemePreference,
        accent: legacy === "evergreen" ? "evergreen" : legacy === "blue" ? "blue" : "burgundy",
      });
      await saveAppearance(migrated);
      return migrated;
    }
  } catch {
    // fall through
  }
  return { ...DEFAULT_APPEARANCE };
}

export async function saveAppearance(config: AppearanceConfig): Promise<void> {
  const next = sanitizeAppearance(config);
  await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(next));
  // Keep legacy key in sync so older code paths / ThemeContext hydration stay aligned.
  await AsyncStorage.setItem(THEME_LEGACY_KEY, next.theme);
}

export async function loadSavedLooks(): Promise<SavedLook[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_LOOKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedLook[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((look) => look && typeof look.id === "string" && typeof look.name === "string")
      .map((look) => ({
        ...look,
        config: {
          theme: sanitizeAppearance({ ...DEFAULT_APPEARANCE, ...look.config }).theme,
          accent: sanitizeAppearance({ ...DEFAULT_APPEARANCE, ...look.config }).accent,
          wallpaper: sanitizeAppearance({ ...DEFAULT_APPEARANCE, ...look.config }).wallpaper,
          customWallpaperUri: look.config?.customWallpaperUri ?? null,
          wallpaperBrightness: sanitizeAppearance({ ...DEFAULT_APPEARANCE, ...look.config }).wallpaperBrightness,
          surfaceStyle: sanitizeAppearance({ ...DEFAULT_APPEARANCE, ...look.config }).surfaceStyle,
        },
      }));
  } catch {
    return [];
  }
}

export async function saveSavedLooks(looks: SavedLook[]): Promise<void> {
  await AsyncStorage.setItem(SAVED_LOOKS_STORAGE_KEY, JSON.stringify(looks));
}

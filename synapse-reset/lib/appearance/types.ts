import type { ThemePreference } from "@/contexts/ThemeContext";
import type { WidgetAppearancePreference } from "@/lib/storage";

export type AccentId =
  | "burgundy"
  | "evergreen"
  | "blue"
  | "violet"
  | "rose"
  | "amber"
  | "teal"
  | "slate";

export type WallpaperId =
  | "none"
  | "mist"
  | "linen"
  | "cloud"
  | "softGradient"
  | "aurora"
  | "meadow"
  | "ocean"
  | "dusk"
  | "custom";

export type SurfaceStyleId = "solid" | "soft" | "glass";

export type AppearanceThemePreference = ThemePreference | "blue";

export type AppearanceConfig = {
  theme: AppearanceThemePreference;
  accent: AccentId;
  wallpaper: WallpaperId;
  /** Local file URI when wallpaper === "custom". */
  customWallpaperUri?: string | null;
  wallpaperBrightness: number; // 0.35–1
  surfaceStyle: SurfaceStyleId;
  reduceTransparency: boolean;
  reduceMotion: boolean;
  increasedContrast: boolean;
  widgetAppearance: WidgetAppearancePreference;
};

export type SavedLook = {
  id: string;
  name: string;
  createdAt: string;
  config: Pick<AppearanceConfig, "theme" | "accent" | "wallpaper" | "customWallpaperUri" | "wallpaperBrightness" | "surfaceStyle">;
};

export const APPEARANCE_STORAGE_KEY = "synapse_appearance_v1";
export const SAVED_LOOKS_STORAGE_KEY = "synapse_appearance_saved_looks_v1";

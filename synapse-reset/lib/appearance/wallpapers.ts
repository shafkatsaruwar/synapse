import type { WallpaperId } from "@/lib/appearance/types";

export type WallpaperPreset = {
  id: Exclude<WallpaperId, "custom">;
  label: string;
  /** Soft decorative colors for AppBackground (not for card fills). */
  colors: string[];
};

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: "none", label: "None", colors: [] },
  { id: "mist", label: "Mist", colors: ["#F4F7FA", "#E8EEF5", "#F7F4F1"] },
  { id: "linen", label: "Linen", colors: ["#F7F1EA", "#EFE6DB", "#F4EDE4"] },
  { id: "cloud", label: "Cloud", colors: ["#F5F8FC", "#E7F0F8", "#F8FAFD"] },
  { id: "softGradient", label: "Soft Gradient", colors: ["#F7F5F2", "#EDE8F2", "#E8F1EE"] },
  { id: "aurora", label: "Aurora", colors: ["#EEF3F8", "#E6EEF6", "#F2EBEF"] },
  { id: "meadow", label: "Meadow", colors: ["#F2F6F3", "#E5EFE8", "#F5F3EE"] },
  { id: "ocean", label: "Ocean", colors: ["#EAF2FA", "#DCEAF6", "#F0F5FA"] },
  { id: "dusk", label: "Dusk", colors: ["#F3EEF2", "#E8E4EF", "#F5F0EA"] },
];

export function getWallpaper(id: WallpaperId): WallpaperPreset | null {
  if (id === "custom" || id === "none") return null;
  return WALLPAPER_PRESETS.find((w) => w.id === id) ?? null;
}

/**
 * Sick Mode color palettes that adapt to Light vs Dark app appearance.
 * Use with themeId from useTheme() or colorScheme from useColorScheme().
 */

export type SickModePalette = {
  background: string;
  card: string;
  accent: string;
  text: string;
  progress: string;
  /** Light tint for banners/cards (e.g. alert card background) */
  accentLight: string;
  /** Border color for alert areas */
  accentBorder: string;
};

const LIGHT: SickModePalette = {
  background: "#FFF4F4",
  card: "#FDE2E2",
  accent: "#D32F2F",
  text: "#1A1A1A",
  progress: "#F6C1C1",
  accentLight: "#FDE2E2",
  accentBorder: "rgba(211,47,47,0.35)",
};

const DARK: SickModePalette = {
  background: "#2A0F0F",
  card: "#3A1616",
  accent: "#FF6B6B",
  text: "#FFFFFF",
  progress: "#5A2A2A",
  accentLight: "#3A1616",
  accentBorder: "rgba(255,107,107,0.4)",
};

/** themeId from ThemeContext: "dark" -> dark palette; "light" | "calm" -> light palette. */
export function getSickModePalette(themeId: "calm" | "light" | "dark"): SickModePalette {
  return themeId === "dark" ? DARK : LIGHT;
}

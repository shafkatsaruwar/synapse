/**
 * Sick Mode color palettes — calm recovery companion, not emergency-red by default.
 * Reserve strong red for genuine urgent alerts in UI, not the whole chrome.
 */

export type SickModePalette = {
  background: string;
  card: string;
  accent: string;
  text: string;
  progress: string;
  /** Soft tint for status chips */
  accentLight: string;
  /** Border color for soft cards */
  accentBorder: string;
};

const LIGHT: SickModePalette = {
  background: "transparent",
  card: "#FFFFFF",
  accent: "#8B5E5E",
  text: "#1A1A1A",
  progress: "#E8E0E0",
  accentLight: "rgba(139,94,94,0.10)",
  accentBorder: "rgba(139,94,94,0.18)",
};

const DARK: SickModePalette = {
  background: "transparent",
  card: "#1C1C1E",
  accent: "#E8A0A0",
  text: "#FFFFFF",
  progress: "#3A2A2A",
  accentLight: "rgba(232,160,160,0.12)",
  accentBorder: "rgba(232,160,160,0.22)",
};

/** themeId from ThemeContext: dark / evergreenDark → dark palette; otherwise light. */
export function getSickModePalette(themeId: string): SickModePalette {
  return themeId === "dark" || themeId === "evergreenDark" ? DARK : LIGHT;
}

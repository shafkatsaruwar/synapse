/** Looks shown in Appearance Studio. Names and colors match the app; extra wallpapers are not marketed. */

export type DemoThemeId = "system" | "light" | "dark" | "evergreen" | "calm" | "blue";
export type DemoWallpaperId = "none" | "mist" | "linen" | "cloud";
export type DemoSurfaceId = "solid" | "soft" | "glass";
export type DemoMode = "simple" | "full";

export type DemoTheme = {
  id: DemoThemeId;
  label: string;
  blurb: string;
  background: string;
  text: string;
  muted: string;
  card: string;
  border: string;
  bar: string;
  dark: boolean;
};

export type DemoAccent = { id: string; label: string; hex: string };
export type DemoWallpaper = { id: DemoWallpaperId; label: string; colors: string[] };
export type DemoSurface = { id: DemoSurfaceId; label: string; body: string };

export const APPEARANCE_THEMES: DemoTheme[] = [
  {
    id: "system",
    label: "System",
    blurb: "Follows your device",
    background: "#F7F8FA",
    text: "#111111",
    muted: "#68645F",
    card: "rgba(255,255,255,0.56)",
    border: "rgba(255,255,255,0.84)",
    bar: "#477BAF",
    dark: false,
  },
  {
    id: "light",
    label: "Light",
    blurb: "Clean & classic",
    background: "#F7F8FA",
    text: "#111111",
    muted: "#68645F",
    card: "rgba(255,255,255,0.56)",
    border: "rgba(255,255,255,0.84)",
    bar: "#A30D24",
    dark: false,
  },
  {
    id: "dark",
    label: "Dark",
    blurb: "Comfortable charcoal",
    background: "#0D0B0C",
    text: "#FFFFFF",
    muted: "#B2AAA6",
    card: "rgba(255,250,247,0.11)",
    border: "rgba(255,250,247,0.14)",
    bar: "#D94A5C",
    dark: true,
  },
  {
    id: "evergreen",
    label: "Evergreen",
    blurb: "Fresh muted greens",
    background: "#F7F8FA",
    text: "#20252A",
    muted: "#626B72",
    card: "#FFFFFF",
    border: "#E5E9EB",
    bar: "#477A70",
    dark: false,
  },
  {
    id: "calm",
    label: "Calm",
    blurb: "Warm cream neutrals",
    background: "#F5ECE2",
    text: "#1A1A1A",
    muted: "#675248",
    card: "rgba(255,250,244,0.58)",
    border: "rgba(255,255,255,0.76)",
    bar: "#A30D24",
    dark: false,
  },
  {
    id: "blue",
    label: "Blue",
    blurb: "Airy powder blue",
    background: "#EAF2FA",
    text: "#263B52",
    muted: "#63788E",
    card: "#FFFFFF",
    border: "#D2E0EF",
    bar: "#477BAF",
    dark: false,
  },
];

export const APPEARANCE_ACCENTS: DemoAccent[] = [
  { id: "burgundy", label: "Burgundy", hex: "#A30D24" },
  { id: "evergreen", label: "Evergreen", hex: "#477A70" },
  { id: "blue", label: "Blue", hex: "#477BAF" },
  { id: "violet", label: "Violet", hex: "#6B5B95" },
  { id: "rose", label: "Rose", hex: "#C45B74" },
  { id: "amber", label: "Amber", hex: "#C4841D" },
  { id: "teal", label: "Teal", hex: "#3F8F83" },
  { id: "slate", label: "Slate", hex: "#5A6B7D" },
];

export const APPEARANCE_WALLPAPERS: DemoWallpaper[] = [
  { id: "none", label: "None", colors: [] },
  { id: "mist", label: "Mist", colors: ["#F4F7FA", "#E8EEF5", "#F7F4F1"] },
  { id: "linen", label: "Linen", colors: ["#F7F1EA", "#EFE6DB", "#F4EDE4"] },
  { id: "cloud", label: "Cloud", colors: ["#F5F8FC", "#E7F0F8", "#F8FAFD"] },
];

export const APPEARANCE_SURFACES: DemoSurface[] = [
  { id: "solid", label: "Solid", body: "Opaque cards, maximum readability" },
  { id: "soft", label: "Soft", body: "Gentle depth and restrained shadows" },
  { id: "glass", label: "Glass", body: "Soft translucency with layered light" },
];

export type DemoLook = {
  mode: DemoMode;
  theme: DemoThemeId;
  accent: string;
  wallpaper: DemoWallpaperId;
  surface: DemoSurfaceId;
  reduceTransparency: boolean;
  reduceMotion: boolean;
  increasedContrast: boolean;
};

export const DEFAULT_DEMO_LOOK: DemoLook = {
  mode: "full",
  theme: "blue",
  accent: "blue",
  wallpaper: "none",
  surface: "soft",
  reduceTransparency: false,
  reduceMotion: false,
  increasedContrast: false,
};

export const APPEARANCE_A11Y = [
  { id: "reduceTransparency", label: "Reduce Transparency", body: "Prefer solid, readable surfaces" },
  { id: "reduceMotion", label: "Reduce Motion", body: "Limit decorative motion" },
  { id: "increasedContrast", label: "Increased Contrast", body: "Stronger borders and solid cards" },
] as const;

export function themeById(id: DemoThemeId) {
  return APPEARANCE_THEMES.find((theme) => theme.id === id) ?? APPEARANCE_THEMES[0];
}

export function accentById(id: string) {
  return APPEARANCE_ACCENTS.find((accent) => accent.id === id) ?? APPEARANCE_ACCENTS[2];
}

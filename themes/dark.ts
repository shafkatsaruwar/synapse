// Dark theme – true black with layered depth
const dark = {
  id: "dark" as const,
  // Layered backgrounds for depth
  background: "#000000",        // main screen background
  surface: "#0B0B0B",           // dashboard bottom cards
  surfaceElevated: "#0D0D0D",   // hero / elevated surfaces
  surfaceHover: "#111111",      // mini cards inside hero, hover states
  // Borders
  border: "#262626",            // bottom dashboard card borders
  borderLight: "#2A2A2A",       // priority / hero card borders
  // Text
  text: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textTertiary: "#6B6B6B",
  // Brand
  tint: "#8B1E2D",
  tintLight: "rgba(139,30,45,0.20)",
  accent: "#8B1E2D",
  accentLight: "rgba(139,30,45,0.20)",
  // Status colors – vivid enough for dark bg
  green: "#22C55E",
  greenLight: "rgba(34,197,94,0.15)",
  orange: "#F97316",
  orangeLight: "rgba(249,115,22,0.15)",
  red: "#EF4444",
  redLight: "rgba(239,68,68,0.15)",
  yellow: "#EAB308",
  yellowLight: "rgba(234,179,8,0.15)",
  cyan: "#06B6D4",
  cyanLight: "rgba(6,182,212,0.15)",
  pink: "#EC4899",
  pinkLight: "rgba(236,72,153,0.15)",
  purple: "#A855F7",
  purpleLight: "rgba(168,85,247,0.15)",
  tabIconDefault: "#6B6B6B",
  tabIconSelected: "#8B1E2D",
  sidebar: "#0B0B0B",
  sidebarActive: "rgba(139,30,45,0.20)",
  sidebarHover: "rgba(255,255,255,0.05)",
};

export default dark;

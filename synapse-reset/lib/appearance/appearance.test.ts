/**
 * Run: npx tsx synapse-reset/lib/appearance/appearance.test.ts
 */
import assert from "node:assert/strict";
import { DEFAULT_APPEARANCE } from "./defaults";
import { applyAppearanceToTheme } from "./resolve";
import { sanitizeAppearance } from "./storage";
type Theme = {
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
};

const base: Theme = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceHover: "#F0F3F4",
  heroCardBackground: "#FFFFFF",
  border: "#E5E9EB",
  borderLight: "#EEF1F3",
  text: "#20252A",
  textSecondary: "#626B72",
  textTertiary: "#8A939A",
  tint: "#477A70",
  tintLight: "#E5F1ED",
  accent: "#477A70",
  accentLight: "#E5F1ED",
  green: "#2F6F4E",
  greenLight: "rgba(47,111,78,0.12)",
  orange: "#C46A1B",
  orangeLight: "rgba(196,106,27,0.12)",
  red: "#C73A4A",
  redLight: "rgba(199,58,74,0.12)",
  yellow: "#A67C00",
  yellowLight: "rgba(166,124,0,0.12)",
  cyan: "#3D6F9C",
  cyanLight: "rgba(61,111,156,0.12)",
  pink: "#B85A6E",
  pinkLight: "rgba(184,90,110,0.12)",
  purple: "#5E6B8A",
  purpleLight: "rgba(94,107,138,0.12)",
  tabIconDefault: "#8A939A",
  tabIconSelected: "#477A70",
  sidebar: "#FFFFFF",
  sidebarActive: "#E5F1ED",
  sidebarHover: "#F0F3F4",
};

let passed = 0;
let failed = 0;
function check(cond: boolean, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.log("FAIL:", msg);
  }
}

const rose = applyAppearanceToTheme(
  base,
  { ...DEFAULT_APPEARANCE, accent: "rose" },
  "evergreen",
);
check(rose.tint === "#C45B74", "rose accent applies to tint");
check(rose.tabIconSelected === "#C45B74", "rose accent applies to tabs");
check(rose.red === "#C73A4A", "semantic red unchanged");

const solid = applyAppearanceToTheme(
  { ...base, surface: "rgba(255,255,255,0.4)" },
  { ...DEFAULT_APPEARANCE, surfaceStyle: "solid" },
  "calm",
);
check(solid.surface === "#FFFFFF", "solid surface forces opaque white");

const a11y = applyAppearanceToTheme(
  base,
  { ...DEFAULT_APPEARANCE, surfaceStyle: "glass" },
  "blue",
  true,
);
check(a11y.surface === "#FFFFFF", "system reduce transparency forces solid");

const sanitized = sanitizeAppearance({
  theme: "blue",
  accent: "violet",
  wallpaper: "ocean",
  surfaceStyle: "glass",
  widgetAppearance: "calm",
} as never);
check(sanitized.theme === "blue", "blue theme accepted");
check(sanitized.widgetAppearance === "system", "legacy calm widget maps to system");
check(sanitizeAppearance({ theme: "midnight" as never }).theme === "evergreen", "unknown theme falls back");

assert.equal(DEFAULT_APPEARANCE.theme, "evergreen");

console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"} (${passed} passed, ${failed} failed)`);
process.exit(failed === 0 ? 0 : 1);

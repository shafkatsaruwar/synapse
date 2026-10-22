import type { Theme, ThemeId } from "@/contexts/ThemeContext";
import { getAccent } from "@/lib/appearance/accents";
import type { AppearanceConfig, SurfaceStyleId } from "@/lib/appearance/types";

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function isOpaqueSurface(surface: string): boolean {
  return surface.startsWith("#") || (!surface.includes("rgba") && !surface.includes("hsla"));
}

/**
 * Apply accent + surface/accessibility overrides on top of a base theme palette.
 * Status colors (red/orange/yellow/green semantic) stay intact.
 */
export function applyAppearanceToTheme(
  base: Theme,
  config: AppearanceConfig,
  themeId: ThemeId,
  systemReduceTransparency = false,
): Theme {
  const accent = getAccent(config.accent);
  const forceSolid =
    config.reduceTransparency ||
    systemReduceTransparency ||
    config.increasedContrast ||
    config.surfaceStyle === "solid";

  let surface = base.surface;
  let surfaceElevated = base.surfaceElevated;
  let surfaceHover = base.surfaceHover;
  let heroCardBackground = base.heroCardBackground;
  let border = base.border;
  let borderLight = base.borderLight;

  if (forceSolid) {
    const dark = themeId === "dark" || themeId === "evergreenDark";
    surface = dark ? "#1C1A1B" : "#FFFFFF";
    surfaceElevated = dark ? "#242122" : "#FFFFFF";
    surfaceHover = dark ? "#2C292A" : "#F4F6F8";
    heroCardBackground = surface;
    border = dark ? "rgba(255,255,255,0.14)" : "rgba(32,37,42,0.10)";
    borderLight = dark ? "rgba(255,255,255,0.08)" : "rgba(32,37,42,0.06)";
  } else if (config.surfaceStyle === "glass" && isOpaqueSurface(base.surface)) {
    const dark = themeId === "dark" || themeId === "evergreenDark";
    // Opaque bases (Evergreen/Blue/Light) get a frosted wash; dark stays charcoal.
    if (dark) {
      surface = "rgba(28,24,26,0.72)";
      surfaceElevated = "rgba(36,32,34,0.82)";
      surfaceHover = "rgba(44,40,42,0.9)";
      heroCardBackground = "rgba(28,24,26,0.68)";
    } else {
      surface = "rgba(255,255,255,0.72)";
      surfaceElevated = "rgba(255,255,255,0.82)";
      surfaceHover = "rgba(255,255,255,0.9)";
      heroCardBackground = "rgba(255,255,255,0.68)";
    }
  }

  const tintLight =
    accent.light.startsWith("#") || accent.light.startsWith("rgb")
      ? accent.light
      : hexToRgba(accent.hex, 0.12);

  return {
    ...base,
    surface,
    surfaceElevated,
    surfaceHover,
    heroCardBackground,
    border,
    borderLight,
    tint: accent.hex,
    tintLight,
    accent: accent.hex,
    accentLight: tintLight,
    tabIconSelected: accent.hex,
    sidebarActive: tintLight,
  };
}

export function effectiveSurfaceStyle(
  config: AppearanceConfig,
  systemReduceTransparency = false,
): SurfaceStyleId {
  if (config.reduceTransparency || systemReduceTransparency || config.increasedContrast) {
    return "solid";
  }
  return config.surfaceStyle;
}

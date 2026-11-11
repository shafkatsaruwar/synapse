import { NativeModules, Platform, type ImageSourcePropType } from "react-native";

/**
 * Icon choices backed by real bundled iOS assets.
 *
 * Ocean Light is the primary app icon, so selecting it passes null to iOS and
 * restores the default icon. The variants listed in MISSING_APP_ICON_VARIANTS
 * are intentionally omitted until their finalized image files are supplied.
 */
export type AppIconId =
  | "ocean-light"
  | "sage-light"
  | "sage-dark"
  | "amber-light"
  | "rose-light"
  | "copper-light"
  | "copper-dark"
  | "lavender-dark"
  | "chocolate-light"
  | "chocolate-dark"
  | "graphite-light"
  | "graphite-dark";

export type AppIconOption = {
  id: AppIconId;
  family: "Ocean" | "Sage" | "Amber" | "Rose" | "Copper" | "Lavender" | "Chocolate" | "Graphite";
  variant: "Light" | "Dark";
  /** Alternate icon set name in the iOS asset catalog; null = the primary icon. */
  iosName: string | null;
  preview: ImageSourcePropType;
};

/** Finalized variants still needed before the picker can show all 16 choices. */
export const MISSING_APP_ICON_VARIANTS = [
  "Ocean Dark",
  "Amber Dark",
  "Rose Dark",
  "Lavender Light",
] as const;

/* eslint-disable @typescript-eslint/no-require-imports */
export const APP_ICON_OPTIONS: AppIconOption[] = [
  { id: "ocean-light", family: "Ocean", variant: "Light", iosName: null, preview: require("../../assets/app-icons/previews/Ocean-Light.png") },
  { id: "sage-light", family: "Sage", variant: "Light", iosName: "AppIcon-Sage-Light", preview: require("../../assets/app-icons/previews/Sage-Light.png") },
  { id: "sage-dark", family: "Sage", variant: "Dark", iosName: "AppIcon-Sage-Dark", preview: require("../../assets/app-icons/previews/Sage-Dark.png") },
  { id: "amber-light", family: "Amber", variant: "Light", iosName: "AppIcon-Amber-Light", preview: require("../../assets/app-icons/previews/Amber-Light.png") },
  { id: "rose-light", family: "Rose", variant: "Light", iosName: "AppIcon-Rose-Light", preview: require("../../assets/app-icons/previews/Rose-Light.png") },
  { id: "copper-light", family: "Copper", variant: "Light", iosName: "AppIcon-Copper-Light", preview: require("../../assets/app-icons/previews/Copper-Light.png") },
  { id: "copper-dark", family: "Copper", variant: "Dark", iosName: "AppIcon-Copper-Dark", preview: require("../../assets/app-icons/previews/Copper-Dark.png") },
  { id: "lavender-dark", family: "Lavender", variant: "Dark", iosName: "AppIcon-Lavender-Dark", preview: require("../../assets/app-icons/previews/Lavender-Dark.png") },
  { id: "chocolate-light", family: "Chocolate", variant: "Light", iosName: "AppIcon-Chocolate-Light", preview: require("../../assets/app-icons/previews/Chocolate-Light.png") },
  { id: "chocolate-dark", family: "Chocolate", variant: "Dark", iosName: "AppIcon-Chocolate-Dark", preview: require("../../assets/app-icons/previews/Chocolate-Dark.png") },
  { id: "graphite-light", family: "Graphite", variant: "Light", iosName: "AppIcon-Graphite-Light", preview: require("../../assets/app-icons/previews/Graphite-Light.png") },
  { id: "graphite-dark", family: "Graphite", variant: "Dark", iosName: "AppIcon-Graphite-Dark", preview: require("../../assets/app-icons/previews/Graphite-Dark.png") },
];
/* eslint-enable @typescript-eslint/no-require-imports */

/** Accent matching stays explicit and never changes the icon for system appearance. */
export const ACCENT_TO_ICON: Record<string, AppIconId> = {
  burgundy: "copper-light",
  evergreen: "sage-dark",
  blue: "ocean-light",
  violet: "lavender-dark",
  rose: "rose-light",
  amber: "amber-light",
  teal: "sage-dark",
  slate: "graphite-light",
};

type AppIconNative = {
  getIconName: () => Promise<string | null>;
  setIconName: (name: string | null) => Promise<string | null>;
};

function getNative(): AppIconNative | null {
  if (Platform.OS !== "ios") return null;
  return (NativeModules.SynapseAppIconBridge as AppIconNative | undefined) ?? null;
}

/** True only in a native iOS build that includes the icon bridge (not Expo Go / web). */
export function canChangeAppIcon(): boolean {
  return getNative() !== null;
}

export function appIconIdFromIosName(name: string | null | undefined): AppIconId {
  const normalized = name ?? null;
  const selected = APP_ICON_OPTIONS.find((option) => option.iosName === normalized);
  if (selected) return selected.id;

  // Versions before the variant picker used family-level names. Treat those
  // as a light/default choice while the next native build migrates the user.
  const legacyMap: Record<string, AppIconId> = {
    "AppIcon-Ocean": "ocean-light",
    "AppIcon-Sage": "sage-light",
    "AppIcon-Amber": "amber-light",
    "AppIcon-Rose": "rose-light",
    "AppIcon-Copper": "copper-light",
    "AppIcon-Lavender": "lavender-dark",
    "AppIcon-Chocolate": "chocolate-light",
    "AppIcon-Graphite": "graphite-light",
  };
  return (normalized && legacyMap[normalized]) || "ocean-light";
}

export async function getCurrentAppIcon(): Promise<AppIconId> {
  const native = getNative();
  if (!native) return "ocean-light";
  try {
    return appIconIdFromIosName(await native.getIconName());
  } catch {
    return "ocean-light";
  }
}

export async function setAppIcon(id: AppIconId): Promise<void> {
  const native = getNative();
  if (!native) return;
  const option = APP_ICON_OPTIONS.find((candidate) => candidate.id === id);
  if (!option) throw new Error("That app icon is not available in this build.");
  await native.setIconName(option.iosName);
}

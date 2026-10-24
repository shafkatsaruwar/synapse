import { NativeModules, Platform, type ImageSourcePropType } from "react-native";

export type AppIconId =
  | "default"
  | "ocean"
  | "sage"
  | "amber"
  | "rose"
  | "copper"
  | "lavender"
  | "chocolate"
  | "graphite";

export type AppIconOption = {
  id: AppIconId;
  label: string;
  /** Alternate icon set name in the iOS asset catalog; null = the primary icon. */
  iosName: string | null;
  light: ImageSourcePropType;
  dark?: ImageSourcePropType;
};

/* eslint-disable @typescript-eslint/no-require-imports */
export const APP_ICON_OPTIONS: AppIconOption[] = [
  {
    id: "default",
    label: "Classic",
    iosName: null,
    light: require("../../assets/icon-light.png"),
    dark: require("../../assets/icon-dark.png"),
  },
  {
    id: "ocean",
    label: "Ocean",
    iosName: "AppIcon-Ocean",
    light: require("../../assets/app-icons/previews/Ocean-Light.png"),
  },
  {
    id: "sage",
    label: "Sage",
    iosName: "AppIcon-Sage",
    light: require("../../assets/app-icons/previews/Sage-Light.png"),
    dark: require("../../assets/app-icons/previews/Sage-Dark.png"),
  },
  {
    id: "amber",
    label: "Amber",
    iosName: "AppIcon-Amber",
    light: require("../../assets/app-icons/previews/Amber-Light.png"),
  },
  {
    id: "rose",
    label: "Rose",
    iosName: "AppIcon-Rose",
    light: require("../../assets/app-icons/previews/Rose-Light.png"),
  },
  {
    id: "copper",
    label: "Copper",
    iosName: "AppIcon-Copper",
    light: require("../../assets/app-icons/previews/Copper-Light.png"),
    dark: require("../../assets/app-icons/previews/Copper-Dark.png"),
  },
  {
    id: "lavender",
    label: "Lavender",
    iosName: "AppIcon-Lavender",
    // Lavender ships as a dark icon only.
    light: require("../../assets/app-icons/previews/Lavender-Dark.png"),
  },
  {
    id: "chocolate",
    label: "Chocolate",
    iosName: "AppIcon-Chocolate",
    light: require("../../assets/app-icons/previews/Chocolate-Light.png"),
    dark: require("../../assets/app-icons/previews/Chocolate-Dark.png"),
  },
  {
    id: "graphite",
    label: "Graphite",
    iosName: "AppIcon-Graphite",
    light: require("../../assets/app-icons/previews/Graphite-Light.png"),
    dark: require("../../assets/app-icons/previews/Graphite-Dark.png"),
  },
];
/* eslint-enable @typescript-eslint/no-require-imports */

/** Which app icon goes with each accent color. Classic and Chocolate stay manual-only. */
export const ACCENT_TO_ICON: Record<string, AppIconId> = {
  burgundy: "copper",
  evergreen: "sage",
  blue: "ocean",
  violet: "lavender",
  rose: "rose",
  amber: "amber",
  teal: "sage",
  slate: "graphite",
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
  return APP_ICON_OPTIONS.find((o) => o.iosName === (name ?? null))?.id ?? "default";
}

export async function getCurrentAppIcon(): Promise<AppIconId> {
  const native = getNative();
  if (!native) return "default";
  try {
    return appIconIdFromIosName(await native.getIconName());
  } catch {
    return "default";
  }
}

export async function setAppIcon(id: AppIconId): Promise<void> {
  const native = getNative();
  if (!native) return;
  const option = APP_ICON_OPTIONS.find((o) => o.id === id);
  await native.setIconName(option?.iosName ?? null);
}

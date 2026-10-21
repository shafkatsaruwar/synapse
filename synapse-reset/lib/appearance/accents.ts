import type { AccentId } from "@/lib/appearance/types";

export type AccentSwatch = {
  id: AccentId;
  label: string;
  hex: string;
  light: string;
};

export const ACCENT_SWATCHES: AccentSwatch[] = [
  { id: "burgundy", label: "Burgundy", hex: "#A30D24", light: "rgba(163,13,36,0.12)" },
  { id: "evergreen", label: "Evergreen", hex: "#477A70", light: "#E5F1ED" },
  { id: "blue", label: "Blue", hex: "#477BAF", light: "#DFEBF8" },
  { id: "violet", label: "Violet", hex: "#6B5B95", light: "rgba(107,91,149,0.14)" },
  { id: "rose", label: "Rose", hex: "#C45B74", light: "rgba(196,91,116,0.14)" },
  { id: "amber", label: "Amber", hex: "#C4841D", light: "rgba(196,132,29,0.14)" },
  { id: "teal", label: "Teal", hex: "#3F8F83", light: "rgba(63,143,131,0.14)" },
  { id: "slate", label: "Slate", hex: "#5A6B7D", light: "rgba(90,107,125,0.14)" },
];

export function getAccent(id: AccentId): AccentSwatch {
  return ACCENT_SWATCHES.find((s) => s.id === id) ?? ACCENT_SWATCHES[0];
}

import type { Group } from "three";
import type { SceneSample } from "@/lib/animation/scene-sample";

export const panelGroups: (Group | null)[] = [];

/** Mutable frame state shared by the studio. Not React state — the animation must not re-render per frame. */
export const sceneBridge = {
  progress: 0,
  locked: false,
  mobile: false,
  quality: "high" as "high" | "low",
  visible: true,
  sample: null as SceneSample | null,
};

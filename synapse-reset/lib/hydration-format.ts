import type { HydrationUnit } from "@/lib/storage";

/** Format a milliliter total for human-readable UI (worldly units). */
export function formatHydrationVolume(ml: number): string {
  if (!Number.isFinite(ml) || ml <= 0) return "0 mL";
  if (ml < 1000) {
    const rounded = Math.round(ml);
    // Prefer glasses when it lands near a clean glass (240 mL).
    if (rounded >= 200 && Math.abs(rounded % 240) <= 20) {
      const glasses = Math.max(1, Math.round(rounded / 240));
      return `${glasses} glass${glasses === 1 ? "" : "es"}`;
    }
    return `${rounded} mL`;
  }
  const liters = ml / 1000;
  const fixed = liters >= 10 ? liters.toFixed(0) : liters.toFixed(1);
  return `${fixed.replace(/\.0$/, "")} L`;
}

export function formatHydrationProgress(currentMl: number, goalMl: number): string {
  return `${formatHydrationVolume(currentMl)} / ${formatHydrationVolume(goalMl)}`;
}

export function describeHydrationUnit(unit: HydrationUnit): string {
  switch (unit) {
    case "glasses":
      return "glasses";
    case "oz":
      return "oz";
    case "L":
      return "L";
    case "ml":
    default:
      return "mL";
  }
}

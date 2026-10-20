/**
 * Pure helpers for Sick Mode check-in transitions.
 * Temperature alone must never declare recovery — only an explicit "better" feeling.
 */
import type { SickModeData } from "@/lib/storage";

export type FeelingChoice = "better" | "same" | "worse";

export const CHECK_IN_INTERVAL_MS = 2 * 60 * 60 * 1000;

export type CheckInInput = {
  feeling: FeelingChoice;
  temperatureF?: number | null;
  note?: string | null;
  nowMs?: number;
};

export type CheckInResult = {
  next: SickModeData;
  highFever: boolean;
  enteredRecovering: boolean;
};

export function applyCheckIn(sickData: SickModeData, input: CheckInInput): CheckInResult {
  const nowMs = input.nowMs ?? Date.now();
  const note = input.note?.trim() || "";
  const symptoms = note
    ? Array.from(new Set([...(sickData.symptoms || []), note]))
    : sickData.symptoms || [];

  let temperatures = sickData.temperatures || [];
  const temp = input.temperatureF;
  const hasTemp = temp != null && Number.isFinite(temp);
  if (hasTemp) {
    const time = new Date(nowMs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    temperatures = [...temperatures, { time, value: temp as number }];
  }

  const highFever = hasTemp && (temp as number) >= 102;
  const enteredRecovering = input.feeling === "better";

  let next: SickModeData = {
    ...sickData,
    temperatures,
    symptoms,
    lastCheckIn: new Date(nowMs).toISOString(),
  };

  if (enteredRecovering) {
    next = { ...next, recoveryMode: true, checkInTimer: undefined };
  } else {
    next = {
      ...next,
      checkInTimer: new Date(nowMs + CHECK_IN_INTERVAL_MS).toISOString(),
    };
  }

  return { next, highFever, enteredRecovering };
}

/** Temperature logging alone must not flip recoveryMode. */
export function applyTemperatureLog(sickData: SickModeData, value: number, nowMs = Date.now()): SickModeData {
  const time = new Date(nowMs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return {
    ...sickData,
    temperatures: [...(sickData.temperatures || []), { time, value }],
  };
}

import assert from "node:assert/strict";
import { applyCheckIn, applyTemperatureLog } from "./sick-mode-checkin";
import type { SickModeData } from "./storage";

const base: SickModeData = {
  active: true,
  startedAt: "2026-10-20T12:00:00.000Z",
  checkInTimer: "2026-10-20T14:00:00.000Z",
  hydrationMl: 0,
  foodChecklist: { lightMeal: false, saltySnack: false, liquidCalories: false },
  restChecklist: { lying: false, napping: false, screenBreak: false },
  symptoms: [],
  temperatures: [],
  prnDoses: [],
};

{
  console.log("1. Feeling better enters recovering without requiring temperature");
  const { next, enteredRecovering, highFever } = applyCheckIn(base, { feeling: "better", nowMs: Date.parse("2026-10-20T15:00:00.000Z") });
  assert.equal(enteredRecovering, true);
  assert.equal(next.recoveryMode, true);
  assert.equal(next.checkInTimer, undefined);
  assert.equal(highFever, false);
}

{
  console.log("2. Low temperature alone does not enter recovering");
  const logged = applyTemperatureLog(base, 98.2, Date.parse("2026-10-20T15:00:00.000Z"));
  assert.equal(logged.recoveryMode, undefined);
  assert.equal(logged.temperatures?.length, 1);
  const { next, enteredRecovering } = applyCheckIn(base, {
    feeling: "same",
    temperatureF: 98.2,
    nowMs: Date.parse("2026-10-20T15:00:00.000Z"),
  });
  assert.equal(enteredRecovering, false);
  assert.notEqual(next.recoveryMode, true);
  assert.ok(next.checkInTimer);
}

{
  console.log("3. High fever flagged while staying active on worse/same");
  const { next, highFever, enteredRecovering } = applyCheckIn(base, {
    feeling: "worse",
    temperatureF: 103,
    nowMs: Date.parse("2026-10-20T15:00:00.000Z"),
  });
  assert.equal(highFever, true);
  assert.equal(enteredRecovering, false);
  assert.ok(next.checkInTimer);
  assert.equal(next.temperatures?.at(-1)?.value, 103);
}

{
  console.log("4. Optional note appended to symptoms");
  const { next } = applyCheckIn(base, {
    feeling: "same",
    note: "Headache",
    nowMs: Date.parse("2026-10-20T15:00:00.000Z"),
  });
  assert.ok(next.symptoms?.includes("Headache"));
}

console.log("sick-mode-checkin: all assertions passed");

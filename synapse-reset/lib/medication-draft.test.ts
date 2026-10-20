/**
 * Guided Add Medication draft helpers.
 * Run: npx tsx synapse-reset/lib/medication-draft.test.ts
 */
import {
  buildMedicationPayload,
  canContinueHow,
  canContinueIdentity,
  canContinueWhen,
  canSaveDraft,
  createEmptyDraft,
  createEmptyDose,
  draftFromMedication,
  draftFromScan,
  nextGuidedStep,
  previousGuidedStep,
  resolveRemindersEnabled,
  type AddMedicationDraft,
} from "./medication-draft";
import type { Medication } from "./storage";

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}

function baseDraft(overrides: Partial<AddMedicationDraft> = {}): AddMedicationDraft {
  return {
    ...createEmptyDraft("self"),
    name: "Hydrocortisone",
    medicationType: "scheduled",
    doses: [
      createEmptyDose({ id: "d1", amount: "10", unit: "mg", timeOfDay: "Morning", reminderTime: "08:00" }),
      createEmptyDose({ id: "d2", amount: "5", unit: "mg", timeOfDay: "Night", reminderTime: "21:00" }),
    ],
    remindersEnabled: true,
    ...overrides,
  };
}

console.log("\nmedication-draft tests\n");

{
  console.log("1. Identity validation");
  assert(!canContinueIdentity(createEmptyDraft()), "empty name blocked");
  assert(canContinueIdentity(baseDraft()), "named draft allowed");
}

{
  console.log("2. Scheduled vs PRN how-step");
  assert(canContinueHow(baseDraft()), "two different doses allowed");
  assert(
    !canContinueHow(baseDraft({ medicationType: null })),
    "type required",
  );
  const prn = baseDraft({
    medicationType: "prn",
    doses: [createEmptyDose({ amount: "200", unit: "mg", timeOfDay: "As Needed" })],
    remindersEnabled: false,
  });
  assert(canContinueHow(prn), "PRN single dose allowed");
  assert(nextGuidedStep("how", "prn") === "review", "PRN skips when-step");
  assert(nextGuidedStep("how", "scheduled") === "when", "scheduled goes to when");
  assert(previousGuidedStep("review", "prn") === "how", "PRN back from review to how");
}

{
  console.log("3. Reminders optional for schedule");
  const noReminders = baseDraft({
    remindersEnabled: false,
    doses: [
      createEmptyDose({ id: "d1", amount: "10", unit: "mg", timeOfDay: "Morning", reminderTime: "" }),
    ],
  });
  assert(canContinueWhen(noReminders), "schedule saves without reminder times");
  assert(canSaveDraft(noReminders), "full save allowed with reminders off");
  const payload = buildMedicationPayload(noReminders);
  assert(payload.remindersEnabled === false, "payload marks reminders disabled");
  assert(payload.doses?.[0]?.reminderTime == null, "no invented reminderTime");
  assert(payload.doses?.[0]?.timeOfDay === "Morning", "prescribed time-of-day kept");
}

{
  console.log("4. Different dose amounts preserved");
  const payload = buildMedicationPayload(baseDraft());
  assert(payload.doses?.length === 2, "two doses");
  assert(payload.doses?.[0]?.amount === "10" && payload.doses?.[1]?.amount === "5", "distinct amounts");
  assert(payload.frequency === "Every day", "daily frequency label");
}

{
  console.log("5. Weekly cadence");
  const weekly = baseDraft({
    reminderCadence: "weekly",
    reminderWeekday: 2,
  });
  const payload = buildMedicationPayload(weekly);
  assert(payload.reminderCadence === "weekly", "weekly cadence stored");
  assert(payload.reminderWeekday === 2, "weekday stored");
  assert(payload.frequency?.includes("week"), "frequency mentions week");
}

{
  console.log("6. Custom cadence validation");
  const bad = baseDraft({ reminderCadence: "custom", reminderIntervalValue: "" });
  assert(!canContinueWhen(bad), "empty custom interval blocked");
  const good = baseDraft({
    reminderCadence: "custom",
    reminderIntervalValue: "3",
    reminderIntervalUnit: "days",
  });
  assert(canContinueWhen(good), "valid custom interval allowed");
}

{
  console.log("7. Preserve advanced fields on edit");
  const existing: Medication = {
    id: "m1",
    name: "Hydrocortisone",
    frequency: "Every day",
    active: true,
    medicationType: "scheduled",
    hasStressDose: true,
    stressDoseAmount: "20 mg",
    stressDoseInstructions: "Double if fever",
    doctorId: "doc-1",
    pharmacyName: "Main Pharmacy",
    currentSupplyAmount: 40,
    inventoryUnit: "Tablets",
    remindersEnabled: true,
    doses: [{ id: "d1", amount: "10", unit: "mg", timeOfDay: "Morning", reminderTime: "08:00" }],
  };
  const draft = draftFromMedication(existing);
  draft.name = "Hydrocortisone (edited)";
  draft.doses = [
    createEmptyDose({ id: "d1", amount: "10", unit: "mg", timeOfDay: "Morning", reminderTime: "08:00" }),
    createEmptyDose({ id: "d2", amount: "5", unit: "mg", timeOfDay: "Night", reminderTime: "21:00" }),
  ];
  const payload = buildMedicationPayload(draft, { existing });
  assert(payload.hasStressDose === true, "stress dose preserved");
  assert(payload.stressDoseInstructions === "Double if fever", "protocol text preserved");
  assert(payload.doctorId === "doc-1", "doctor preserved");
  assert(payload.pharmacyName === "Main Pharmacy", "pharmacy preserved");
  assert(payload.currentSupplyAmount === 40, "inventory preserved");
  assert(payload.doses?.length === 2, "new dose added without wiping advanced fields");
}

{
  console.log("8. Scan draft requires review (reminders off)");
  const scanned = draftFromScan({ name: "Lisinopril", dosage: "10", unit: "mg" });
  assert(scanned.source === "scan", "source is scan");
  assert(scanned.remindersEnabled === false, "scan does not enable reminders");
  assert(scanned.name === "Lisinopril", "name imported");
}

{
  console.log("9. Legacy remindersEnabled resolution");
  assert(resolveRemindersEnabled(undefined) === true, "undefined = enabled (legacy)");
  assert(resolveRemindersEnabled({}) === true, "missing field = enabled");
  assert(resolveRemindersEnabled({ remindersEnabled: false }) === false, "explicit false");
  assert(resolveRemindersEnabled({ remindersEnabled: true }) === true, "explicit true");
}

{
  console.log("10. PRN payload");
  const prn = baseDraft({
    medicationType: "prn",
    doses: [createEmptyDose({ amount: "500", unit: "mg", timeOfDay: "As Needed" })],
    remindersEnabled: false,
  });
  const payload = buildMedicationPayload(prn);
  assert(payload.medicationType === "prn", "prn type");
  assert(payload.frequency === "As Needed", "as needed frequency");
  assert(payload.remindersEnabled === false, "prn reminders off");
  assert(payload.hasStressDose === false, "prn clears stress dose");
  assert(payload.doses?.[0]?.timeOfDay === "As Needed", "as needed time tag");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

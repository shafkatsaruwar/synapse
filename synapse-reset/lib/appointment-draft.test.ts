/**
 * Guided Add Appointment draft helpers.
 * Run: npx tsx synapse-reset/lib/appointment-draft.test.ts
 */
import {
  applyDoctorToDraft,
  buildAppointmentPayload,
  canContinueWhen,
  canContinueWho,
  canSaveAppointmentDraft,
  clearLinkedDoctor,
  createEmptyAppointmentDraft,
  draftFromImport,
  formatRecurrenceLabel,
  nextAppointmentStep,
  previousAppointmentStep,
} from "./appointment-draft";
import type { Doctor } from "./storage";

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

console.log("\nappointment-draft tests\n");

{
  console.log("1. Manual create without saved doctor");
  const d = createEmptyAppointmentDraft();
  assert(!canContinueWho(d), "empty name blocked");
  d.doctorName = "Dr. Rivera";
  assert(canContinueWho(d), "free-text name allowed");
  assert(!d.doctorId, "no doctor id");
  d.date = "2026-11-01";
  assert(!canContinueWhen(d), "unconfirmed time blocked");
  d.time = "09:00";
  d.timeConfirmed = false;
  assert(!canContinueWhen(d), "time shown but not confirmed blocked");
  d.timeConfirmed = true;
  assert(canContinueWhen(d), "confirmed time allowed");
  const payload = buildAppointmentPayload(d);
  assert(payload.doctorName === "Dr. Rivera", "name saved");
  assert(payload.doctor_id == null, "no linked doctor created");
  assert(payload.time === "09:00", "explicit time kept");
}

{
  console.log("2. Linked doctor prefill");
  const doctor: Doctor = {
    id: "doc-1",
    name: "Dr. Chen",
    specialty: "Endocrinology",
    hospital: "City Clinic",
    address: "100 Main St",
    entryOwner: "self",
  };
  let d = createEmptyAppointmentDraft();
  d = applyDoctorToDraft(d, doctor);
  assert(d.doctorId === "doc-1", "doctor linked");
  assert(d.specialty === "Endocrinology", "specialty prefilled");
  assert(d.location === "City Clinic", "hospital preferred for location");
  assert(d.doctorDefaultLocation === "City Clinic", "default location snapshot");
}

{
  console.log("3. Appointment-specific location override");
  const doctor: Doctor = {
    id: "doc-1",
    name: "Dr. Chen",
    specialty: "Endo",
    hospital: "City Clinic",
    entryOwner: "self",
  };
  let d = applyDoctorToDraft(createEmptyAppointmentDraft(), doctor);
  d.location = "Outpatient Pavilion Room 3";
  d.date = "2026-11-02";
  d.time = "14:30";
  d.timeConfirmed = true;
  const payload = buildAppointmentPayload(d);
  assert(payload.location === "Outpatient Pavilion Room 3", "override kept");
  assert(payload.doctor_id === "doc-1", "still linked");
}

{
  console.log("4. No silent 9:00 default");
  const d = createEmptyAppointmentDraft();
  d.doctorName = "Clinic";
  d.date = "2026-11-03";
  assert(!canSaveAppointmentDraft(d), "cannot save without time");
  let threw = false;
  try {
    buildAppointmentPayload(d);
  } catch {
    threw = true;
  }
  assert(threw, "build throws when incomplete");
}

{
  console.log("5. Recurrence presets");
  const d = createEmptyAppointmentDraft();
  d.doctorName = "Dr. A";
  d.date = "2026-11-04";
  d.time = "10:00";
  d.timeConfirmed = true;
  d.repeatOption = "week";
  let payload = buildAppointmentPayload(d);
  assert(payload.is_recurring === true && payload.repeat_interval === 1 && payload.repeat_unit === "week", "weekly");
  assert(!!payload.repeat_end_date, "end date set");
  d.repeatOption = "2weeks";
  payload = buildAppointmentPayload(d);
  assert(payload.repeat_interval === 2 && payload.repeat_unit === "week", "biweekly");
  d.repeatOption = "month";
  payload = buildAppointmentPayload(d);
  assert(payload.repeat_interval === 1 && payload.repeat_unit === "month", "monthly");
  d.repeatOption = "custom";
  d.customInterval = "3";
  d.customUnit = "day";
  assert(canContinueWhen(d), "custom valid");
  payload = buildAppointmentPayload(d);
  assert(payload.repeat_interval === 3 && payload.repeat_unit === "day", "custom days");
  assert(!!formatRecurrenceLabel(d)?.includes("3"), "label shows custom");
}

{
  console.log("6. Custom cadence validation");
  const d = createEmptyAppointmentDraft();
  d.doctorName = "X";
  d.date = "2026-11-05";
  d.time = "11:00";
  d.timeConfirmed = true;
  d.repeatOption = "custom";
  d.customInterval = "";
  assert(!canContinueWhen(d), "empty custom blocked");
}

{
  console.log("7. End time after start");
  const d = createEmptyAppointmentDraft();
  d.doctorName = "X";
  d.date = "2026-11-05";
  d.time = "11:00";
  d.timeConfirmed = true;
  d.endTime = "10:00";
  d.endTimeConfirmed = true;
  assert(!canContinueWhen(d), "end before start blocked");
  d.endTime = "11:30";
  assert(canContinueWhen(d), "end after start ok");
}

{
  console.log("8. Caregiver ownership");
  const d = createEmptyAppointmentDraft("care_recipient");
  d.doctorName = "Pediatrician";
  d.date = "2026-11-06";
  d.time = "09:30";
  d.timeConfirmed = true;
  const payload = buildAppointmentPayload(d);
  assert(payload.entryOwner === "care_recipient", "owner preserved");
}

{
  console.log("9. Free-text does not keep stale doctor link");
  let d = applyDoctorToDraft(createEmptyAppointmentDraft(), {
    id: "doc-9",
    name: "Dr. Old",
    specialty: "GP",
    hospital: "Hospital",
    entryOwner: "self",
  });
  d = clearLinkedDoctor(d, "Someone else");
  assert(!d.doctorId, "link cleared");
  assert(d.doctorName === "Someone else", "typed name kept");
}

{
  console.log("10. Import draft marks source and confirmed time");
  const scanned = draftFromImport({
    doctorName: "Dr. Scan",
    date: "2026-12-01",
    time: "15:00",
    location: "Lobby",
    source: "scan",
  });
  assert(scanned.source === "scan", "source scan");
  assert(scanned.timeConfirmed === true, "imported time confirmed for review");
  assert(nextAppointmentStep("who") === "when", "step who→when");
  assert(previousAppointmentStep("review") === "where", "back review→where");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

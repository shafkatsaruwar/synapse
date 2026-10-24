/** Run: npx tsx --test lib/care/edit-flow.test.ts  (two simulated phones, owner reviews every change) */
import { useDevice, resetAllDevices } from "./test-mocks";
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { selfStores, SELF_PROFILE_ID, setActiveProfileId } from "../storage";
import {
  acceptInvitation, completeWithAcceptance, confirmVerification, createOutgoingInvitation, loadConnections, previewInvitation,
  resetIdentityCacheForTests, revokeConnection, setGrants,
} from "./connections";
import { applyImport, buildExportPayload, createExportPackage, previewImport } from "./sharing";
import { applyChanges, buildChangePackage, declineChanges, isSelectable, loadEdits, newChangeId, previewChanges, proposableCategories } from "./changes";
import type { CareConnection, ProposedChange, SharingCategory } from "./types";

beforeEach(() => {
  resetAllDevices();
  resetIdentityCacheForTests();
});

const swap = (name: string) => {
  useDevice(name);
  resetIdentityCacheForTests();
  setActiveProfileId(SELF_PROFILE_ID);
};

const med = (name: string, time: string) => ({ name, frequency: "daily", active: true, doses: [{ id: "d", amount: "200", unit: "mcg", timeOfDay: "Morning", reminderTime: time }] });
const get = async (name: string) => (await loadConnections())[0] as CareConnection & { id: string };

/** Jason (owner) and Sarah (caregiver) pair up; Jason grants `grants`; Sarah imports his snapshot. */
async function setup(grants: { category: SharingCategory; access: "view" | "edit" }[]) {
  swap("jason");
  const { link } = await createOutgoingInvitation({ myName: "Jason", myTimeZone: "Europe/London", role: "they_care_for_me", requests: [] });
  await selfStores.medicationStorage.save(med("Levothyroxine", "08:00"));
  const levo = (await selfStores.medicationStorage.getAll())[0];
  await selfStores.appointmentStorage.save({ doctorName: "Dr. Patel", specialty: "", date: "2999-05-01", time: "10:00", location: "Clinic", notes: "" });
  const appt = (await selfStores.appointmentStorage.getAll())[0];
  swap("sarah");
  const preview = await previewInvitation(link);
  if (!preview.ok) throw new Error("invite");
  const { replyLink } = await acceptInvitation(preview.invitation, { myName: "Sarah", myTimeZone: "America/New_York", grants: [] });
  swap("jason");
  await completeWithAcceptance(replyLink);
  const jc = await get("jason");
  await confirmVerification(jc.id, true);
  await setGrants(jc.id, grants);
  const granted = await get("jason");
  const payload = await buildExportPayload(granted, "Jason", "Europe/London");
  const pkg = await createExportPackage(granted, payload);
  if (!pkg.ok) throw new Error("export");
  swap("sarah");
  const sc = await get("sarah");
  await confirmVerification(sc.id, true);
  const imp = await previewImport(pkg.json);
  if (!imp.ok) throw new Error("import preview");
  await applyImport(imp);
  return { levo, appt };
}

const BOTH: { category: SharingCategory; access: "view" | "edit" }[] = [
  { category: "med_schedule", access: "edit" },
  { category: "upcoming_appointments", access: "edit" },
  { category: "med_confirmations", access: "edit" },
];

test("edit grant is shared in the snapshot so the caregiver knows what they may propose", async () => {
  await setup(BOTH);
  const sc = await get("sarah");
  assert.deepEqual((await proposableCategories(sc)).sort(), ["med_confirmations", "med_schedule", "upcoming_appointments"]);
});

test("view-only grant: caregiver cannot even build a proposal, and the owner would reject one anyway", async () => {
  await setup([{ category: "med_schedule", access: "view" }]);
  const sc = await get("sarah");
  assert.deepEqual(await proposableCategories(sc), []);
  const change: ProposedChange = { id: newChangeId(), category: "med_schedule", op: "add", after: { name: "Vitamin D", times: ["09:00"] } };
  assert.deepEqual(await buildChangePackage(sc, [change], "Sarah", "America/New_York"), { ok: false, reason: "not_authorized" });
});

test("owner must approve: nothing changes until accepted, then only accepted changes apply, with provenance", async () => {
  const { levo, appt } = await setup(BOTH);
  const sc = await get("sarah");
  const changes: ProposedChange[] = [
    { id: "c1", category: "med_schedule", op: "update", key: levo.id, before: { name: "Levothyroxine", amount: "200", unit: "mcg", times: ["08:00"] }, after: { times: ["09:00"] } },
    { id: "c2", category: "med_schedule", op: "add", after: { name: "Vitamin D", amount: "1000", unit: "IU", times: ["08:30"] } },
    { id: "c3", category: "upcoming_appointments", op: "update", key: appt.id, before: { date: "2999-05-01", time: "10:00" }, after: { time: "11:30" } },
    { id: "c4", category: "med_confirmations", op: "confirm", after: { medicationKey: levo.id, medicationName: "Levothyroxine", date: "2030-01-01", doseIndex: 0 } },
  ];
  const pkg = await buildChangePackage(sc, changes, "Sarah", "America/New_York");
  assert.ok(pkg.ok);
  if (!pkg.ok) return;
  assert.ok(!pkg.json.includes("Vitamin D"), "proposal is encrypted");

  swap("jason");
  const preview = await previewChanges(pkg.json);
  assert.ok(preview.ok);
  if (!preview.ok) return;
  assert.equal(preview.rows.length, 4);
  assert.ok(preview.rows.every((r) => r.status === "ok"));
  // Previewing changed nothing.
  assert.equal((await selfStores.medicationStorage.getAll()).length, 1);
  assert.equal((await selfStores.medicationStorage.getAll())[0].doses![0].reminderTime, "08:00");

  // Owner accepts c1, c3, c4 and declines c2.
  const result = await applyChanges(preview, ["c1", "c3", "c4"]);
  assert.deepEqual(result, { applied: 3, skipped: 1 });
  const meds = await selfStores.medicationStorage.getAll();
  assert.equal(meds.length, 1, "declined addition was not applied");
  assert.equal(meds[0].doses![0].reminderTime, "09:00");
  assert.equal(meds[0].doses![0].amount, "200", "unchanged fields are kept");
  assert.equal(meds[0].changedBy?.name, "Sarah");
  assert.equal(meds[0].changedBy?.via, "care_connection");
  assert.equal((await selfStores.appointmentStorage.getAll())[0].time, "11:30");
  const logs = await selfStores.medicationLogStorage.getAll();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].enteredBy, "caregiver", "caregiver confirmation is labelled as such");
  const history = await loadEdits();
  assert.equal(history.length, 3);
  assert.ok(history.every((h) => h.fromName === "Sarah"));
});

test("accepting an addition creates a normal record; stopping a medication only deactivates it", async () => {
  const { levo } = await setup(BOTH);
  const sc = await get("sarah");
  const pkg = await buildChangePackage(sc, [
    { id: "a", category: "med_schedule", op: "add", after: { name: "Vitamin D", amount: "1000", unit: "IU", times: ["08:30", "20:00"] } },
    { id: "b", category: "med_schedule", op: "stop", key: levo.id, before: { name: "Levothyroxine" } },
    { id: "c", category: "upcoming_appointments", op: "add", after: { date: "2999-06-01", time: "14:00", doctorName: "Dr. Lee" } },
  ], "Sarah", "America/New_York");
  assert.ok(pkg.ok);
  if (!pkg.ok) return;
  swap("jason");
  const preview = await previewChanges(pkg.json);
  if (!preview.ok) throw new Error("preview");
  await applyChanges(preview, ["a", "b", "c"]);
  const meds = await selfStores.medicationStorage.getAll();
  assert.equal(meds.length, 2, "nothing deleted");
  const vit = meds.find((m) => m.name === "Vitamin D")!;
  assert.deepEqual(vit.doses!.map((d) => d.reminderTime), ["08:30", "20:00"]);
  assert.deepEqual(vit.doses!.map((d) => d.timeOfDay), ["Morning", "Evening"]);
  assert.equal(meds.find((m) => m.id === levo.id)!.active, false);
  assert.equal((await selfStores.appointmentStorage.getAll()).length, 2);
});

test("conflicts are flagged when the owner's record moved on, and are not applied unless chosen", async () => {
  const { levo } = await setup(BOTH);
  const sc = await get("sarah");
  const pkg = await buildChangePackage(sc, [{ id: "c1", category: "med_schedule", op: "update", key: levo.id, before: { times: ["08:00"] }, after: { times: ["09:00"] } }], "Sarah", "America/New_York");
  if (!pkg.ok) throw new Error("pkg");
  swap("jason");
  await selfStores.medicationStorage.update(levo.id, { doses: [{ id: "d", amount: "200", unit: "mcg", timeOfDay: "Morning", reminderTime: "07:00" }] });
  const preview = await previewChanges(pkg.json);
  if (!preview.ok) throw new Error("preview");
  assert.equal(preview.rows[0].status, "conflict");
  assert.deepEqual(preview.rows[0].conflicts, ["times"]);
  assert.equal(isSelectable(preview.rows[0]), true, "owner can still choose to apply it");
  assert.deepEqual(await applyChanges(preview, []), { applied: 0, skipped: 1 });
  assert.equal((await selfStores.medicationStorage.getAll())[0].doses![0].reminderTime, "07:00");
});

test("a record deleted since is reported missing and cannot be applied", async () => {
  const { levo } = await setup(BOTH);
  const sc = await get("sarah");
  const pkg = await buildChangePackage(sc, [{ id: "c1", category: "med_schedule", op: "stop", key: levo.id, before: {} }], "Sarah", "America/New_York");
  if (!pkg.ok) throw new Error("pkg");
  swap("jason");
  await selfStores.medicationStorage.delete(levo.id);
  const preview = await previewChanges(pkg.json);
  if (!preview.ok) throw new Error("preview");
  assert.equal(preview.rows[0].status, "missing");
  assert.deepEqual(await applyChanges(preview, ["c1"]), { applied: 0, skipped: 1 });
});

test("owner enforces authorization: downgrading to view-only, or revoking, rejects an existing proposal", async () => {
  await setup(BOTH);
  const sc = await get("sarah");
  const pkg = await buildChangePackage(sc, [{ id: "c1", category: "med_schedule", op: "add", after: { name: "X", times: ["09:00"] } }], "Sarah", "America/New_York");
  if (!pkg.ok) throw new Error("pkg");
  swap("jason");
  const jc = await get("jason");
  await setGrants(jc.id, [{ category: "med_schedule", access: "view" }]);
  assert.deepEqual(await previewChanges(pkg.json), { ok: false, reason: "not_authorized" });
  await setGrants(jc.id, [{ category: "upcoming_appointments", access: "edit" }]);
  assert.deepEqual(await previewChanges(pkg.json), { ok: false, reason: "nothing_allowed" }, "granted edit for a different category does not cover this one");
  await revokeConnection(jc.id);
  const gone = await previewChanges(pkg.json);
  assert.equal(gone.ok, false);
});

test("partial authorization: changes outside the granted categories are blocked, others still reviewable", async () => {
  const { levo } = await setup(BOTH);
  const sc = await get("sarah");
  const pkg = await buildChangePackage(sc, [
    { id: "m", category: "med_schedule", op: "stop", key: levo.id, before: {} },
    { id: "a", category: "upcoming_appointments", op: "add", after: { date: "2999-07-01" } },
  ], "Sarah", "America/New_York");
  if (!pkg.ok) throw new Error("pkg");
  swap("jason");
  const jc = await get("jason");
  await setGrants(jc.id, [{ category: "med_schedule", access: "edit" }, { category: "upcoming_appointments", access: "view" }]);
  const preview = await previewChanges(pkg.json);
  if (!preview.ok) throw new Error("preview");
  assert.deepEqual(preview.rows.map((r) => r.status), ["ok", "not_authorized"]);
  const r = await applyChanges(preview, ["m", "a"]);
  assert.deepEqual(r, { applied: 1, skipped: 1 });
  assert.equal((await selfStores.appointmentStorage.getAll()).length, 1, "unauthorized addition never applied");
});

test("replay, tamper, wrong-recipient, and decline are all handled", async () => {
  await setup(BOTH);
  const sc = await get("sarah");
  const pkg = await buildChangePackage(sc, [{ id: "c1", category: "med_schedule", op: "add", after: { name: "X", times: ["09:00"] } }], "Sarah", "America/New_York");
  if (!pkg.ok) throw new Error("pkg");
  const env = JSON.parse(pkg.json);
  swap("jason");
  const tampered = await previewChanges(JSON.stringify({ ...env, ct: env.ct.slice(0, -3) + "AAA" }));
  assert.equal(tampered.ok, false);
  const preview = await previewChanges(pkg.json);
  if (!preview.ok) throw new Error("preview");
  await declineChanges(preview);
  assert.deepEqual(await previewChanges(pkg.json), { ok: false, reason: "replayed" });
  assert.equal((await selfStores.medicationStorage.getAll()).length, 1, "declining changes nothing");
  // Sarah cannot apply her own proposal to herself: it is addressed to Jason.
  swap("sarah");
  assert.equal((await previewChanges(pkg.json)).ok, false);
});

test("snapshots and proposals are kept apart: a proposal is not treated as a snapshot", async () => {
  await setup(BOTH);
  const sc = await get("sarah");
  const pkg = await buildChangePackage(sc, [{ id: "c1", category: "med_schedule", op: "add", after: { name: "X", times: ["09:00"] } }], "Sarah", "America/New_York");
  if (!pkg.ok) throw new Error("pkg");
  swap("jason");
  assert.deepEqual(await previewImport(pkg.json), { ok: false, reason: "is_changes" });
});

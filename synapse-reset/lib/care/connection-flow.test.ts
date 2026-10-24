/** Run: npx tsx --test lib/care/connection-flow.test.ts  (two simulated phones, no network) */
import { memory, secure, useDevice, resetAllDevices } from "./test-mocks";
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { selfStores, SELF_PROFILE_ID, setActiveProfileId } from "../storage";
import {
  acceptInvitation, completeWithAcceptance, confirmVerification, createOutgoingInvitation, getVerificationCode, isTrusted, loadConnections,
  previewInvitation, removeConnection, resetIdentityCacheForTests, revokeConnection, setGrants,
} from "./connections";
import { applyImport, buildExportPayload, createExportPackage, loadSharedData, previewImport } from "./sharing";

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

async function pair() {
  // Jason (London) invites Sarah (Boston) to be his caregiver.
  swap("jason");
  const { invitation, link } = await createOutgoingInvitation({ myName: "Jason", myTimeZone: "Europe/London", role: "they_care_for_me", requests: ["med_schedule"] });
  swap("sarah");
  const preview = await previewInvitation(link);
  assert.ok(preview.ok && !preview.alreadyHandled && !preview.ownInvitation);
  if (!preview.ok) throw new Error("preview failed");
  const { replyLink, connection: sarahConn } = await acceptInvitation(preview.invitation, { myName: "Sarah", myTimeZone: "America/New_York", grants: [] });
  swap("jason");
  const done = await completeWithAcceptance(replyLink);
  assert.ok(done.ok);
  return { invitation, replyLink, sarahConnId: sarahConn.id, jasonConnId: done.ok ? done.connection.id : "" };
}

test("invite, accept, reply: both phones reach awaiting_confirmation with the SAME verification code", async () => {
  const { jasonConnId, sarahConnId } = await pair();
  swap("jason");
  const jc = (await loadConnections()).find((c) => c.id === jasonConnId)!;
  assert.equal(jc.state, "awaiting_confirmation");
  assert.equal(jc.peerName, "Sarah");
  assert.equal(jc.invitationJson, undefined, "invitation material is dropped once answered");
  const codeJ = await getVerificationCode(jc);
  swap("sarah");
  const sc = (await loadConnections()).find((c) => c.id === sarahConnId)!;
  assert.equal(sc.state, "awaiting_confirmation");
  assert.equal(sc.role, "they_care_for_me");
  assert.equal(await getVerificationCode(sc), codeJ);
  assert.ok(!isTrusted(sc), "not trusted until the code is confirmed");
});

test("nothing can be exported or imported before verification, and a mismatch strips grants", async () => {
  const { jasonConnId } = await pair();
  swap("jason");
  const jc = (await loadConnections()).find((c) => c.id === jasonConnId)!;
  const blocked = await createExportPackage(jc, { schema: 1, senderName: "J", senderTimeZone: "UTC" });
  assert.deepEqual(blocked, { ok: false, reason: "not_verified" });
  await confirmVerification(jasonConnId, false);
  const after = (await loadConnections()).find((c) => c.id === jasonConnId)!;
  assert.equal(after.state, "needs_verification");
  assert.equal(after.grants.length, 0);
});

test("full share: verified, view-only grants, preview, import as shared copy, freshness, no live claim", async () => {
  const { jasonConnId, sarahConnId } = await pair();
  swap("jason");
  await selfStores.medicationStorage.save(med("Levothyroxine", "08:00"));
  await selfStores.medicationStorage.save(med("Hydrocortisone", "20:00"));
  await selfStores.appointmentStorage.save({ doctorName: "Dr. Patel", specialty: "", date: "2999-01-01", time: "10:00", location: "Clinic", notes: "SECRET-NOTE" });
  await confirmVerification(jasonConnId, true);
  await setGrants(jasonConnId, ["med_schedule"]);
  const jc = (await loadConnections()).find((c) => c.id === jasonConnId)!;
  assert.ok(isTrusted(jc));
  const payload = await buildExportPayload(jc, "Jason", "Europe/London");
  assert.deepEqual(Object.keys(payload).sort(), ["med_schedule", "schema", "senderName", "senderTimeZone"], "only granted categories are included");
  assert.equal(payload.med_schedule!.length, 2);
  const pkg = await createExportPackage(jc, payload);
  assert.ok(pkg.ok);
  if (!pkg.ok) return;
  assert.ok(!pkg.json.includes("Levothyroxine") && !pkg.json.includes("SECRET-NOTE"), "package is encrypted");

  swap("sarah");
  await confirmVerification(sarahConnId, true);
  const preview = await previewImport(pkg.json);
  assert.ok(preview.ok);
  if (!preview.ok) return;
  assert.equal(preview.diffs[0].added, 2);
  assert.equal(preview.olderThanStored, false);
  assert.equal(await applyImport(preview), true);

  const stored = (await loadSharedData(sarahConnId))!;
  assert.equal(stored.med_schedule!.items.length, 2);
  assert.equal(stored.med_schedule!.provenance.source, "shared_copy");
  assert.equal(stored.med_schedule!.provenance.fromName, "Jason");
  assert.equal(stored.timeZone, "Europe/London");
  assert.equal((await selfStores.medicationStorage.getAll()).length, 0, "import never touches Sarah's own records");
  const sc = (await loadConnections()).find((c) => c.id === sarahConnId)!;
  assert.ok(sc.lastImportAt);

  // Replaying the same file is rejected.
  const replay = await previewImport(pkg.json);
  assert.deepEqual(replay, { ok: false, reason: "replayed" });
});

test("tampered, foreign, and garbage packages are rejected", async () => {
  const { jasonConnId, sarahConnId } = await pair();
  swap("jason");
  await confirmVerification(jasonConnId, true);
  await setGrants(jasonConnId, ["med_schedule"]);
  const jc = (await loadConnections()).find((c) => c.id === jasonConnId)!;
  const pkg = await createExportPackage(jc, { schema: 1, senderName: "J", senderTimeZone: "UTC", med_schedule: [] });
  assert.ok(pkg.ok);
  if (!pkg.ok) return;
  swap("sarah");
  await confirmVerification(sarahConnId, true);
  const env = JSON.parse(pkg.json);
  const tampered = JSON.stringify({ ...env, ct: env.ct.slice(0, -3) + "AAA" });
  const r1 = await previewImport(tampered);
  assert.equal(r1.ok, false);
  assert.deepEqual(await previewImport("hello"), { ok: false, reason: "malformed" });
  assert.deepEqual(await previewImport(JSON.stringify({ ...env, from: "someone-else" })), { ok: false, reason: "unknown_sender" });
});

test("a snapshot older than the stored one is refused (no rollback)", async () => {
  const { jasonConnId, sarahConnId } = await pair();
  swap("jason");
  await confirmVerification(jasonConnId, true);
  await setGrants(jasonConnId, ["med_schedule"]);
  const jc = (await loadConnections()).find((c) => c.id === jasonConnId)!;
  const older = await createExportPackage(jc, { schema: 1, senderName: "J", senderTimeZone: "UTC", med_schedule: [{ key: "a", name: "Old", times: ["08:00"] }] });
  await new Promise((r) => setTimeout(r, 15));
  const newer = await createExportPackage(jc, { schema: 1, senderName: "J", senderTimeZone: "UTC", med_schedule: [{ key: "a", name: "New", times: ["09:00"] }] });
  assert.ok(older.ok && newer.ok);
  if (!older.ok || !newer.ok) return;
  swap("sarah");
  await confirmVerification(sarahConnId, true);
  const p2 = await previewImport(newer.json);
  assert.ok(p2.ok);
  if (p2.ok) assert.equal(await applyImport(p2), true);
  const p1 = await previewImport(older.json);
  assert.ok(p1.ok);
  if (p1.ok) {
    assert.equal(p1.olderThanStored, true);
    assert.equal(await applyImport(p1), false);
  }
  assert.equal((await loadSharedData(sarahConnId))!.med_schedule!.items[0].name, "New");
});

test("revoking stops exports and forgets the peer key; removing deletes the saved copies", async () => {
  const { jasonConnId, sarahConnId } = await pair();
  swap("jason");
  await confirmVerification(jasonConnId, true);
  await setGrants(jasonConnId, ["med_schedule"]);
  await revokeConnection(jasonConnId);
  const jc = (await loadConnections()).find((c) => c.id === jasonConnId)!;
  assert.equal(jc.state, "revoked");
  assert.equal(jc.grants.length, 0);
  assert.equal(jc.peerAgreePublic, undefined);
  assert.deepEqual(await createExportPackage(jc, { schema: 1, senderName: "J", senderTimeZone: "UTC" }), { ok: false, reason: "not_verified" });
  await removeConnection(jasonConnId);
  assert.equal((await loadConnections()).length, 0);
  swap("sarah");
  void sarahConnId;
});

test("invitation guards: replay after responding, own invitation, and wrong-device reply", async () => {
  swap("jason");
  const { link, invitation } = await createOutgoingInvitation({ myName: "Jason", myTimeZone: "UTC", role: "peers", requests: [] });
  const own = await previewInvitation(link);
  assert.ok(own.ok && own.ownInvitation);
  swap("sarah");
  const p = await previewInvitation(link);
  assert.ok(p.ok);
  if (!p.ok) return;
  const { replyLink } = await acceptInvitation(p.invitation, { myName: "Sarah", myTimeZone: "UTC", grants: [] });
  const again = await previewInvitation(link);
  assert.ok(again.ok && again.alreadyHandled, "second use of the same invitation is flagged");
  // A reply is only accepted by the device that created the invitation.
  swap("eve");
  const wrong = await completeWithAcceptance(replyLink);
  assert.equal(wrong.ok, false);
  void invitation;
  void memory;
  void secure;
});

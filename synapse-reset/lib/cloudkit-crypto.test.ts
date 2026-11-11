/** Run: npx tsx --test lib/cloudkit-crypto.test.ts */
import test from "node:test";
import assert from "node:assert/strict";
import {
  decryptBackupEnvelope,
  encryptBackupPayload,
  generateBackupDek,
  parseCloudKitBackupEnvelope,
  passphraseFailureMessage,
  unwrapDek,
  validatePassphraseConfirmation,
  wrapDek,
} from "./cloudkit-crypto";

const passphrase = "correct horse battery staple";

test("passphrase validation rejects short and mismatched values", () => {
  assert.equal(validatePassphraseConfirmation("short", "short"), "too_short");
  assert.equal(validatePassphraseConfirmation(passphrase, "different-passphrase"), "mismatch");
  assert.equal(validatePassphraseConfirmation(passphrase, passphrase), null);
});

test("wrap/unwrap DEK with recovery passphrase", async () => {
  const dek = generateBackupDek();
  assert.equal(dek.length, 32);
  const wrap = await wrapDek(dek, passphrase);
  assert.equal(wrap.kdf, "scrypt");
  assert.ok(!JSON.stringify(wrap).includes(Buffer.from(dek).toString("base64")));

  const ok = await unwrapDek(wrap, passphrase);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.dek, dek);

  const bad = await unwrapDek(wrap, "wrong passphrase!!");
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.reason, "wrong_passphrase");
});

test("encryptBackupPayload round-trips and never embeds raw DEK", async () => {
  const dek = generateBackupDek();
  const wrap = await wrapDek(dek, passphrase);
  const payload = {
    exportDate: "2026-11-11T15:00:00.000Z",
    appVersion: "1.17.0",
    schemaVersion: 1,
    medications: [{ id: "m1", name: "ExampleMed" }],
    appointments: [{ id: "a1" }, { id: "a2" }],
    healthLogs: [],
    profile: { conditions: ["ExampleCondition"] },
  };

  const envelope = await encryptBackupPayload(payload, dek, wrap, payload.exportDate);
  assert.equal(envelope.alg, "AES-256-GCM");
  assert.equal(envelope.summary.medicationCount, 1);
  assert.equal(envelope.summary.appointmentCount, 2);
  assert.equal(envelope.summary.conditionCount, 1);
  const serialized = JSON.stringify(envelope);
  assert.ok(!serialized.includes("ExampleMed"), "ciphertext must not contain medication names in clear");
  // Raw DEK bytes must not appear as a contiguous latin1 string in the envelope.
  assert.ok(!serialized.includes(String.fromCharCode(...dek)));

  const decrypted = await decryptBackupEnvelope(envelope, dek);
  assert.equal(decrypted.ok, true);
  if (decrypted.ok) {
    assert.equal((decrypted.payload.medications as { name: string }[])[0].name, "ExampleMed");
  }

  const wrongDek = generateBackupDek();
  const failed = await decryptBackupEnvelope(envelope, wrongDek);
  assert.equal(failed.ok, false);
});

test("parseCloudKitBackupEnvelope rejects corrupted and legacy plaintext", () => {
  assert.equal(parseCloudKitBackupEnvelope("not-json").ok, false);
  const legacy = parseCloudKitBackupEnvelope(
    JSON.stringify({ exportDate: "2026-01-01T00:00:00.000Z", medications: [] }),
  );
  assert.equal(legacy.ok, false);
  if (!legacy.ok) assert.equal(legacy.reason, "legacy_plaintext");
  assert.match(passphraseFailureMessage("legacy_plaintext"), /unencrypted/i);
});

test("tampered ciphertext fails closed", async () => {
  const dek = generateBackupDek();
  const wrap = await wrapDek(dek, passphrase);
  const envelope = await encryptBackupPayload(
    { exportDate: "2026-11-11T15:00:00.000Z", medications: [] },
    dek,
    wrap,
  );
  const tampered = { ...envelope, ct: envelope.ct.slice(0, -4) + "aaaa" };
  const result = await decryptBackupEnvelope(tampered, dek);
  assert.equal(result.ok, false);
});

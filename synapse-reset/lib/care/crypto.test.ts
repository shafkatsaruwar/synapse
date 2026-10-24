/** Run: npx tsx --test lib/care/crypto.test.ts */
import test from "node:test";
import assert from "node:assert/strict";
import {
  createAcceptance, createInvitation, decryptPackage, encryptPackage, fingerprint, fromBase64Url, generateIdentity,
  pairId, parseAcceptance, parseInvitation, toBase64Url, verificationCode,
} from "./crypto";

const sarah = generateIdentity();
const jason = generateIdentity();

test("base64url round-trips all lengths", () => {
  for (let n = 0; n < 70; n++) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
    assert.deepEqual(fromBase64Url(toBase64Url(bytes)), bytes);
  }
  assert.throws(() => fromBase64Url("a$b"));
});

test("invitation signs, parses, and stays small enough for a QR", () => {
  const inv = createInvitation(sarah, { name: "Sarah", relationship: "caregiver", requests: ["med_schedule"], timeZone: "America/New_York" });
  const raw = JSON.stringify(inv);
  assert.ok(raw.length < 700, `invite is ${raw.length} bytes`);
  const parsed = parseInvitation(raw);
  assert.ok(parsed.ok);
});

test("tampered invitation is rejected", () => {
  const inv = createInvitation(sarah, { name: "Sarah", relationship: "caregiver", requests: [], timeZone: "UTC" });
  const forged = { ...inv, name: "Mallory" };
  const r = parseInvitation(JSON.stringify(forged));
  assert.deepEqual(r, { ok: false, reason: "bad_signature" });
  const swapped = { ...inv, sp: toBase64Url(jason.signPublic) };
  assert.equal(parseInvitation(JSON.stringify(swapped)).ok, false);
});

test("expired, malformed, and wrong-version invitations are rejected", () => {
  const inv = createInvitation(sarah, { name: "Sarah", relationship: "peer", requests: [], timeZone: "UTC" }, 1_000);
  assert.deepEqual(parseInvitation(JSON.stringify(inv), 1_000 + 8 * 86_400_000), { ok: false, reason: "expired" });
  assert.deepEqual(parseInvitation("not json"), { ok: false, reason: "malformed" });
  assert.deepEqual(parseInvitation("{}"), { ok: false, reason: "malformed" });
  assert.deepEqual(parseInvitation(JSON.stringify({ ...inv, v: 2 })), { ok: false, reason: "unsupported_version" });
  assert.equal(parseInvitation("x".repeat(5000)).ok, false);
});

test("acceptance must answer the right invitation and be signed", () => {
  const inv = createInvitation(sarah, { name: "Sarah", relationship: "caregiver", requests: [], timeZone: "UTC" });
  const acc = createAcceptance(jason, inv, { name: "Jason", timeZone: "Europe/London" });
  assert.ok(parseAcceptance(JSON.stringify(acc), inv.id, sarah.signPublic).ok);
  assert.equal(parseAcceptance(JSON.stringify(acc), "other-id", sarah.signPublic).ok, false);
  assert.equal(parseAcceptance(JSON.stringify(acc), inv.id, jason.signPublic).ok, false);
  assert.equal(parseAcceptance(JSON.stringify({ ...acc, name: "Eve" }), inv.id, sarah.signPublic).ok, false);
});

test("both phones compute the same verification code and pair id; a swapped key does not", () => {
  const a = verificationCode(sarah, jason);
  const b = verificationCode(jason, sarah);
  assert.equal(a, b);
  assert.match(a, /^\d{3} \d{3}$/);
  const mallory = generateIdentity();
  assert.notEqual(verificationCode(sarah, mallory), b);
  assert.equal(pairId(sarah.signPublic, jason.signPublic), pairId(jason.signPublic, sarah.signPublic));
  assert.match(fingerprint(sarah.signPublic), /^[0-9A-F]{4}( [0-9A-F]{4}){3}$/);
});

test("package encrypts for the recipient only and round-trips", () => {
  const payload = { med_schedule: [{ name: "Levothyroxine", times: ["08:00"] }] };
  const env = encryptPackage(jason, sarah, payload);
  const raw = JSON.stringify(env);
  assert.ok(!raw.includes("Levothyroxine"), "payload must not appear in clear");
  const r = decryptPackage(sarah, jason, raw, new Set());
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.payload, payload);
});

test("package rejects tampering, wrong recipient, wrong sender, and replay", () => {
  const env = encryptPackage(jason, sarah, { a: 1 });
  const raw = JSON.stringify(env);
  const flipped = { ...env, ct: env.ct.slice(0, -2) + (env.ct.endsWith("AA") ? "BB" : "AA") };
  assert.equal(decryptPackage(sarah, jason, JSON.stringify(flipped), new Set()).ok, false);
  const mallory = generateIdentity();
  assert.deepEqual(decryptPackage(mallory, jason, raw, new Set()), { ok: false, reason: "wrong_recipient" });
  assert.deepEqual(decryptPackage(sarah, mallory, raw, new Set()), { ok: false, reason: "unknown_sender" });
  assert.deepEqual(decryptPackage(sarah, jason, raw, new Set([env.id])), { ok: false, reason: "replayed" });
  // Re-signed by an attacker with a different identity must fail signature verification.
  const forged = encryptPackage(mallory, sarah, { a: 1 });
  assert.equal(decryptPackage(sarah, jason, JSON.stringify({ ...forged, from: env.from }), new Set()).ok, false);
  assert.deepEqual(decryptPackage(sarah, jason, "garbage", new Set()), { ok: false, reason: "malformed" });
});

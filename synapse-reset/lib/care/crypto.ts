/**
 * Care-connection cryptography. Everything here is built from audited @noble primitives:
 *   - Ed25519 signatures for identity (invitations, acceptances, packages)
 *   - X25519 key agreement + HKDF-SHA256 for a per-pair secret
 *   - XChaCha20-Poly1305 for authenticated encryption of shared packages
 * No custom algorithms, no network access. Randomness is injected so the same code runs under
 * Node tests and React Native (expo-crypto).
 */
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";

export type RandomBytes = (length: number) => Uint8Array;

let randomSource: RandomBytes = (length) => {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (!c?.getRandomValues) throw new Error("No secure random source configured");
  return c.getRandomValues(new Uint8Array(length));
};

/** React Native wires expo-crypto in here at startup. */
export function setRandomSource(source: RandomBytes): void {
  randomSource = source;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) out += B64[((b1 & 15) << 2) | (b2 >> 6)];
    if (i + 2 < bytes.length) out += B64[b2 & 63];
  }
  return out;
}

export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw new Error("Invalid encoding");
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const c = [0, 1, 2, 3].map((k) => (i + k < text.length ? B64.indexOf(text[i + k]) : -1));
    bytes.push((c[0] << 2) | (c[1] >> 4));
    if (c[2] >= 0) bytes.push(((c[1] & 15) << 4) | (c[2] >> 2));
    if (c[3] >= 0) bytes.push(((c[2] & 3) << 6) | c[3]);
  }
  return Uint8Array.from(bytes);
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type DeviceIdentity = {
  /** Ed25519 seed (private). Lives only in the iOS Keychain. */
  signSecret: Uint8Array;
  signPublic: Uint8Array;
  /** X25519 secret (private). Lives only in the iOS Keychain. */
  agreeSecret: Uint8Array;
  agreePublic: Uint8Array;
};

export function generateIdentity(): DeviceIdentity {
  const signSecret = randomSource(32);
  const agreeSecret = randomSource(32);
  return {
    signSecret,
    signPublic: ed25519.getPublicKey(signSecret),
    agreeSecret,
    agreePublic: x25519.getPublicKey(agreeSecret),
  };
}

export function identityFromSecrets(signSecret: Uint8Array, agreeSecret: Uint8Array): DeviceIdentity {
  return {
    signSecret,
    signPublic: ed25519.getPublicKey(signSecret),
    agreeSecret,
    agreePublic: x25519.getPublicKey(agreeSecret),
  };
}

export function randomId(bytes = 16): string {
  return toHex(randomSource(bytes));
}

/** Short, human-comparable fingerprint of an identity key. */
export function fingerprint(signPublic: Uint8Array): string {
  const h = toHex(sha256(signPublic)).slice(0, 16).toUpperCase();
  return `${h.slice(0, 4)} ${h.slice(4, 8)} ${h.slice(8, 12)} ${h.slice(12, 16)}`;
}

/**
 * Six-digit verification code both people read aloud. It binds both identity and agreement keys,
 * so an attacker who swapped keys in transit produces different codes on the two phones.
 */
export function verificationCode(a: { signPublic: Uint8Array; agreePublic: Uint8Array }, b: { signPublic: Uint8Array; agreePublic: Uint8Array }): string {
  const ka = toHex(a.signPublic) + toHex(a.agreePublic);
  const kb = toHex(b.signPublic) + toHex(b.agreePublic);
  const [first, second] = ka < kb ? [ka, kb] : [kb, ka];
  const digest = sha256(enc.encode(`synapse-care-sas-v1|${first}|${second}`));
  const n = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
  const code = String(n % 1_000_000).padStart(6, "0");
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/** Stable identifier shared by both sides of one pairing. */
export function pairId(signPublicA: Uint8Array, signPublicB: Uint8Array): string {
  const ha = toHex(signPublicA);
  const hb = toHex(signPublicB);
  const [x, y] = ha < hb ? [ha, hb] : [hb, ha];
  return toHex(sha256(enc.encode(`synapse-care-pair-v1|${x}|${y}`))).slice(0, 32);
}

// ---------- signed messages ----------

function signingBytes(tag: string, fields: (string | number)[]): Uint8Array {
  return enc.encode(JSON.stringify([tag, ...fields]));
}

export function signFields(identity: DeviceIdentity, tag: string, fields: (string | number)[]): string {
  return toBase64Url(ed25519.sign(signingBytes(tag, fields), identity.signSecret));
}

export function verifyFields(signPublic: Uint8Array, tag: string, fields: (string | number)[], signature: string): boolean {
  try {
    return ed25519.verify(fromBase64Url(signature), signingBytes(tag, fields), signPublic);
  } catch {
    return false;
  }
}

// ---------- invitation / acceptance ----------

export const INVITE_VERSION = 1;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITE_MAX_BYTES = 2_000;
const INVITE_TAG = "synapse-care-invite-v1";
const ACCEPT_TAG = "synapse-care-accept-v1";

export type InvitationRelationship = "caregiver" | "cared_for" | "peer";
const RELATIONSHIPS: InvitationRelationship[] = ["caregiver", "cared_for", "peer"];

export type Invitation = {
  v: 1;
  t: "invite";
  id: string;
  createdAt: number;
  expiresAt: number;
  name: string;
  /** What the inviter would be to the recipient. */
  relationship: InvitationRelationship;
  /** Categories the inviter would like to receive. A request only; the recipient decides. */
  requests: string[];
  timeZone: string;
  sp: string;
  ap: string;
  sig: string;
};

export type Acceptance = {
  v: 1;
  t: "accept";
  inviteId: string;
  createdAt: number;
  name: string;
  timeZone: string;
  /** Identity key of the inviter this acceptance answers. */
  to: string;
  sp: string;
  ap: string;
  sig: string;
};

function inviteFields(i: Omit<Invitation, "sig">): (string | number)[] {
  return [i.id, i.createdAt, i.expiresAt, i.name, i.relationship, i.requests.join(","), i.timeZone, i.sp, i.ap];
}

function acceptFields(a: Omit<Acceptance, "sig">): (string | number)[] {
  return [a.inviteId, a.createdAt, a.name, a.timeZone, a.to, a.sp, a.ap];
}

export function createInvitation(
  identity: DeviceIdentity,
  info: { name: string; relationship: InvitationRelationship; requests: string[]; timeZone: string },
  now = Date.now(),
): Invitation {
  const body: Omit<Invitation, "sig"> = {
    v: 1,
    t: "invite",
    id: randomId(16),
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
    name: info.name.trim().slice(0, 60),
    relationship: info.relationship,
    requests: info.requests.slice(0, 8),
    timeZone: info.timeZone,
    sp: toBase64Url(identity.signPublic),
    ap: toBase64Url(identity.agreePublic),
  };
  return { ...body, sig: signFields(identity, INVITE_TAG, inviteFields(body)) };
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: "malformed" | "expired" | "bad_signature" | "unsupported_version" };

function isStr(v: unknown, max = 200): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

export function parseInvitation(raw: string, now = Date.now()): ParseResult<Invitation> {
  if (typeof raw !== "string" || raw.length > INVITE_MAX_BYTES) return { ok: false, reason: "malformed" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const i = data as Partial<Invitation>;
  if (!i || typeof i !== "object" || i.t !== "invite") return { ok: false, reason: "malformed" };
  if (i.v !== 1) return { ok: false, reason: "unsupported_version" };
  if (
    !isStr(i.id, 64) || !isStr(i.name, 60) || !isStr(i.sp, 64) || !isStr(i.ap, 64) || !isStr(i.sig, 128) || !isStr(i.timeZone, 64) ||
    typeof i.createdAt !== "number" || typeof i.expiresAt !== "number" ||
    !RELATIONSHIPS.includes(i.relationship as InvitationRelationship) ||
    !Array.isArray(i.requests) || i.requests.length > 8 || !i.requests.every((r) => isStr(r, 40))
  ) {
    return { ok: false, reason: "malformed" };
  }
  const invite = i as Invitation;
  let sp: Uint8Array;
  try {
    sp = fromBase64Url(invite.sp);
    if (sp.length !== 32 || fromBase64Url(invite.ap).length !== 32) return { ok: false, reason: "malformed" };
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!verifyFields(sp, INVITE_TAG, inviteFields(invite), invite.sig)) return { ok: false, reason: "bad_signature" };
  if (invite.expiresAt <= now || invite.createdAt > now + 5 * 60_000) return { ok: false, reason: "expired" };
  return { ok: true, value: invite };
}

export function createAcceptance(identity: DeviceIdentity, invite: Invitation, info: { name: string; timeZone: string }, now = Date.now()): Acceptance {
  const body: Omit<Acceptance, "sig"> = {
    v: 1,
    t: "accept",
    inviteId: invite.id,
    createdAt: now,
    name: info.name.trim().slice(0, 60),
    timeZone: info.timeZone,
    to: invite.sp,
    sp: toBase64Url(identity.signPublic),
    ap: toBase64Url(identity.agreePublic),
  };
  return { ...body, sig: signFields(identity, ACCEPT_TAG, acceptFields(body)) };
}

export function parseAcceptance(raw: string, expectedInviteId: string, myIdentityPublic: Uint8Array): ParseResult<Acceptance> {
  if (typeof raw !== "string" || raw.length > INVITE_MAX_BYTES) return { ok: false, reason: "malformed" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const a = data as Partial<Acceptance>;
  if (!a || typeof a !== "object" || a.t !== "accept") return { ok: false, reason: "malformed" };
  if (a.v !== 1) return { ok: false, reason: "unsupported_version" };
  if (!isStr(a.inviteId, 64) || !isStr(a.name, 60) || !isStr(a.sp, 64) || !isStr(a.ap, 64) || !isStr(a.to, 64) || !isStr(a.sig, 128) || !isStr(a.timeZone, 64) || typeof a.createdAt !== "number") {
    return { ok: false, reason: "malformed" };
  }
  const accept = a as Acceptance;
  if (accept.inviteId !== expectedInviteId || accept.to !== toBase64Url(myIdentityPublic)) return { ok: false, reason: "malformed" };
  let sp: Uint8Array;
  try {
    sp = fromBase64Url(accept.sp);
    if (sp.length !== 32 || fromBase64Url(accept.ap).length !== 32) return { ok: false, reason: "malformed" };
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!verifyFields(sp, ACCEPT_TAG, acceptFields(accept), accept.sig)) return { ok: false, reason: "bad_signature" };
  return { ok: true, value: accept };
}

// ---------- encrypted, signed data packages ----------

export const PACKAGE_VERSION = 1;
export const PACKAGE_MAX_BYTES = 512_000;
const PKG_TAG = "synapse-care-package-v1";

export type PackageEnvelope = {
  v: 1;
  t: "package";
  id: string;
  exportedAt: number;
  from: string;
  to: string;
  nonce: string;
  ct: string;
  sig: string;
};

function sharedKey(mySecret: Uint8Array, theirPublic: Uint8Array, senderSign: string, recipientSign: string): Uint8Array {
  const secret = x25519.getSharedSecret(mySecret, theirPublic);
  return hkdf(sha256, secret, enc.encode("synapse-care-package-v1"), enc.encode(`${senderSign}>${recipientSign}`), 32);
}

function envelopeFields(e: Omit<PackageEnvelope, "sig">): (string | number)[] {
  return [e.id, e.exportedAt, e.from, e.to, e.nonce, e.ct];
}

export function encryptPackage(
  me: DeviceIdentity,
  recipient: { signPublic: Uint8Array; agreePublic: Uint8Array },
  payload: unknown,
  now = Date.now(),
): PackageEnvelope {
  const from = toBase64Url(me.signPublic);
  const to = toBase64Url(recipient.signPublic);
  const key = sharedKey(me.agreeSecret, recipient.agreePublic, from, to);
  const nonce = randomSource(24);
  const header = { id: randomId(16), exportedAt: now };
  const aad = enc.encode(`${PKG_TAG}|${header.id}|${header.exportedAt}|${from}|${to}`);
  const ct = xchacha20poly1305(key, nonce, aad).encrypt(enc.encode(JSON.stringify(payload)));
  const body: Omit<PackageEnvelope, "sig"> = { v: 1, t: "package", ...header, from, to, nonce: toBase64Url(nonce), ct: toBase64Url(ct) };
  return { ...body, sig: signFields(me, PKG_TAG, envelopeFields(body)) };
}

export type PackageFailure = "malformed" | "unsupported_version" | "wrong_recipient" | "unknown_sender" | "bad_signature" | "decrypt_failed" | "replayed";

export function decryptPackage(
  me: DeviceIdentity,
  sender: { signPublic: Uint8Array; agreePublic: Uint8Array },
  raw: string,
  seenPackageIds: ReadonlySet<string>,
): { ok: true; id: string; exportedAt: number; payload: unknown } | { ok: false; reason: PackageFailure } {
  if (typeof raw !== "string" || raw.length > PACKAGE_MAX_BYTES * 2) return { ok: false, reason: "malformed" };
  let env: PackageEnvelope;
  try {
    env = JSON.parse(raw) as PackageEnvelope;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!env || env.t !== "package") return { ok: false, reason: "malformed" };
  if (env.v !== 1) return { ok: false, reason: "unsupported_version" };
  if (!isStr(env.id, 64) || !isStr(env.from, 64) || !isStr(env.to, 64) || !isStr(env.nonce, 64) || !isStr(env.ct, PACKAGE_MAX_BYTES * 2) || !isStr(env.sig, 128) || typeof env.exportedAt !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (env.to !== toBase64Url(me.signPublic)) return { ok: false, reason: "wrong_recipient" };
  if (env.from !== toBase64Url(sender.signPublic)) return { ok: false, reason: "unknown_sender" };
  const { sig, ...body } = env;
  if (!verifyFields(sender.signPublic, PKG_TAG, envelopeFields(body), sig)) return { ok: false, reason: "bad_signature" };
  if (seenPackageIds.has(env.id)) return { ok: false, reason: "replayed" };
  try {
    const key = sharedKey(me.agreeSecret, sender.agreePublic, env.from, env.to);
    const aad = enc.encode(`${PKG_TAG}|${env.id}|${env.exportedAt}|${env.from}|${env.to}`);
    const plain = xchacha20poly1305(key, fromBase64Url(env.nonce), aad).decrypt(fromBase64Url(env.ct));
    return { ok: true, id: env.id, exportedAt: env.exportedAt, payload: JSON.parse(dec.decode(plain)) };
  } catch {
    return { ok: false, reason: "decrypt_failed" };
  }
}

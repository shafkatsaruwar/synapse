/**
 * Authenticated encryption for private CloudKit backups.
 *
 * Design:
 * - Random 256-bit data-encryption key (DEK) encrypts the JSON backup with AES-256-GCM.
 * - A user recovery passphrase derives a KEK via scrypt and wraps the DEK (also AES-256-GCM).
 * - The wrapped DEK travels with every backup envelope so a replacement device can recover
 *   the DEK after the user enters the same passphrase. The raw DEK never appears in CloudKit.
 * - Snapshot listings may include non-PHI counts only (medicationCount, etc.).
 *
 * Pure module — no React Native imports — so Node unit tests can exercise it.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";

export const CLOUDKIT_BACKUP_ENVELOPE_VERSION = 1;
export const CLOUDKIT_BACKUP_ALG = "AES-256-GCM" as const;
export const CLOUDKIT_PASSPHRASE_MIN_LENGTH = 12;
export const CLOUDKIT_SNAPSHOT_RETENTION = 10;
/** Keep in sync with MANUAL_BACKUP_SCHEMA_VERSION — duplicated to stay RN-free. */
export const CLOUDKIT_MAX_SCHEMA_VERSION = 1;

/** Mobile-friendly scrypt params — still expensive enough for passphrase wrapping. */
export const CLOUDKIT_SCRYPT = {
  N: 2 ** 15,
  r: 8,
  p: 1,
  dkLen: 32,
} as const;

const GCM_NONCE_LENGTH = 12;
const DEK_LENGTH = 32;
const enc = new TextEncoder();
const dec = new TextDecoder();

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(bytes: Uint8Array): string {
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

function fromBase64Url(text: string): Uint8Array {
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

export type CloudKitWrappedDek = {
  kdf: "scrypt";
  salt: string;
  N: number;
  r: number;
  p: number;
  nonce: string;
  ct: string;
};

export type CloudKitBackupSummary = {
  exportDate: string | null;
  appVersion: string | null;
  schemaVersion: number | null;
  medicationCount: number;
  appointmentCount: number;
  healthLogCount: number;
  conditionCount: number;
};

export type CloudKitBackupEnvelope = {
  v: typeof CLOUDKIT_BACKUP_ENVELOPE_VERSION;
  alg: typeof CLOUDKIT_BACKUP_ALG;
  schemaVersion: number;
  createdAt: string;
  nonce: string;
  ct: string;
  wrap: CloudKitWrappedDek;
  /** Non-PHI counts for restore previews without logging medical content. */
  summary: CloudKitBackupSummary;
};

export type PassphraseFailure =
  | "too_short"
  | "mismatch"
  | "wrong_passphrase"
  | "malformed"
  | "unsupported_version"
  | "decrypt_failed";

type RandomBytes = (length: number) => Uint8Array;

let randomSource: RandomBytes = (length) => {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (!c?.getRandomValues) throw new Error("No secure random source configured");
  return c.getRandomValues(new Uint8Array(length));
};

/** Tests and app startup may inject expo-crypto / Node randomness. */
export function setCloudKitRandomSource(source: RandomBytes): void {
  randomSource = source;
}

export function generateBackupDek(): Uint8Array {
  return randomSource(DEK_LENGTH);
}

export function validatePassphrase(passphrase: string): PassphraseFailure | null {
  if (typeof passphrase !== "string" || passphrase.length < CLOUDKIT_PASSPHRASE_MIN_LENGTH) {
    return "too_short";
  }
  return null;
}

export function validatePassphraseConfirmation(
  passphrase: string,
  confirmation: string,
): PassphraseFailure | null {
  const lengthIssue = validatePassphrase(passphrase);
  if (lengthIssue) return lengthIssue;
  if (passphrase !== confirmation) return "mismatch";
  return null;
}

async function deriveKek(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  return scryptAsync(enc.encode(passphrase), salt, { ...CLOUDKIT_SCRYPT });
}

export async function wrapDek(dek: Uint8Array, passphrase: string): Promise<CloudKitWrappedDek> {
  const lengthIssue = validatePassphrase(passphrase);
  if (lengthIssue) throw new Error(`passphrase_${lengthIssue}`);
  const salt = randomSource(16);
  const kek = await deriveKek(passphrase, salt);
  const nonce = randomSource(GCM_NONCE_LENGTH);
  const ct = gcm(kek, nonce).encrypt(dek);
  return {
    kdf: "scrypt",
    salt: toBase64Url(salt),
    N: CLOUDKIT_SCRYPT.N,
    r: CLOUDKIT_SCRYPT.r,
    p: CLOUDKIT_SCRYPT.p,
    nonce: toBase64Url(nonce),
    ct: toBase64Url(ct),
  };
}

export async function unwrapDek(
  wrap: CloudKitWrappedDek,
  passphrase: string,
): Promise<{ ok: true; dek: Uint8Array } | { ok: false; reason: PassphraseFailure }> {
  if (!wrap || wrap.kdf !== "scrypt" || typeof wrap.salt !== "string") {
    return { ok: false, reason: "malformed" };
  }
  try {
    const salt = fromBase64Url(wrap.salt);
    const nonce = fromBase64Url(wrap.nonce);
    const ct = fromBase64Url(wrap.ct);
    const kek = await scryptAsync(enc.encode(passphrase), salt, {
      N: wrap.N || CLOUDKIT_SCRYPT.N,
      r: wrap.r || CLOUDKIT_SCRYPT.r,
      p: wrap.p || CLOUDKIT_SCRYPT.p,
      dkLen: CLOUDKIT_SCRYPT.dkLen,
    });
    const dek = gcm(kek, nonce).decrypt(ct);
    if (dek.length !== DEK_LENGTH) return { ok: false, reason: "decrypt_failed" };
    return { ok: true, dek };
  } catch {
    return { ok: false, reason: "wrong_passphrase" };
  }
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function summarizeBackupPayload(payload: Record<string, unknown>): CloudKitBackupSummary {
  const profile = payload.profile as { conditions?: unknown } | null | undefined;
  const conditionsFromProfile = Array.isArray(profile?.conditions) ? profile!.conditions!.length : 0;
  return {
    exportDate: typeof payload.exportDate === "string" ? payload.exportDate : null,
    appVersion: typeof payload.appVersion === "string" ? payload.appVersion : null,
    schemaVersion: typeof payload.schemaVersion === "number" ? payload.schemaVersion : null,
    medicationCount: countArray(payload.medications),
    appointmentCount: countArray(payload.appointments),
    healthLogCount: countArray(payload.healthLogs),
    conditionCount: Math.max(countArray(payload.conditions), conditionsFromProfile),
  };
}

export function isCloudKitBackupEnvelope(value: unknown): value is CloudKitBackupEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.v === CLOUDKIT_BACKUP_ENVELOPE_VERSION &&
    obj.alg === CLOUDKIT_BACKUP_ALG &&
    typeof obj.createdAt === "string" &&
    typeof obj.nonce === "string" &&
    typeof obj.ct === "string" &&
    obj.wrap != null &&
    typeof obj.wrap === "object"
  );
}

export function parseCloudKitBackupEnvelope(
  text: string,
): { ok: true; envelope: CloudKitBackupEnvelope } | { ok: false; reason: PassphraseFailure | "legacy_plaintext" } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (isCloudKitBackupEnvelope(raw)) {
    if (typeof raw.schemaVersion === "number" && raw.schemaVersion > CLOUDKIT_MAX_SCHEMA_VERSION) {
      return { ok: false, reason: "unsupported_version" };
    }
    return { ok: true, envelope: raw };
  }
  // Legacy unencrypted CloudKit payloads from earlier builds.
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (
      typeof obj.exportDate === "string" ||
      Array.isArray(obj.medications) ||
      Array.isArray(obj.healthLogs)
    ) {
      return { ok: false, reason: "legacy_plaintext" };
    }
  }
  return { ok: false, reason: "malformed" };
}

export async function encryptBackupPayload(
  payload: Record<string, unknown>,
  dek: Uint8Array,
  wrap: CloudKitWrappedDek,
  createdAt = new Date().toISOString(),
): Promise<CloudKitBackupEnvelope> {
  const nonce = randomSource(GCM_NONCE_LENGTH);
  const plaintext = enc.encode(JSON.stringify(payload));
  const aad = enc.encode(`synapse-cloudkit-v${CLOUDKIT_BACKUP_ENVELOPE_VERSION}`);
  const ct = gcm(dek, nonce, aad).encrypt(plaintext);
  return {
    v: CLOUDKIT_BACKUP_ENVELOPE_VERSION,
    alg: CLOUDKIT_BACKUP_ALG,
    schemaVersion:
      typeof payload.schemaVersion === "number" ? payload.schemaVersion : CLOUDKIT_MAX_SCHEMA_VERSION,
    createdAt,
    nonce: toBase64Url(nonce),
    ct: toBase64Url(ct),
    wrap,
    summary: summarizeBackupPayload(payload),
  };
}

export async function decryptBackupEnvelope(
  envelope: CloudKitBackupEnvelope,
  dek: Uint8Array,
): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; reason: PassphraseFailure }> {
  try {
    const aad = enc.encode(`synapse-cloudkit-v${CLOUDKIT_BACKUP_ENVELOPE_VERSION}`);
    const plain = gcm(dek, fromBase64Url(envelope.nonce), aad).decrypt(fromBase64Url(envelope.ct));
    const payload = JSON.parse(dec.decode(plain)) as Record<string, unknown>;
    if (!payload || typeof payload !== "object") return { ok: false, reason: "decrypt_failed" };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "decrypt_failed" };
  }
}

export function passphraseFailureMessage(reason: PassphraseFailure | "legacy_plaintext"): string {
  switch (reason) {
    case "too_short":
      return `Use a recovery passphrase with at least ${CLOUDKIT_PASSPHRASE_MIN_LENGTH} characters.`;
    case "mismatch":
      return "The passphrase and confirmation do not match.";
    case "wrong_passphrase":
      return "That recovery passphrase didn’t unlock this backup. Check it and try again.";
    case "unsupported_version":
      return "This iCloud backup was created by a newer Synapse version. Update the app, then try again.";
    case "legacy_plaintext":
      return "This iCloud backup is from an older unencrypted format. Restoring it is blocked while encrypted backups are required.";
    case "malformed":
      return "This iCloud backup looks damaged or incomplete.";
    case "decrypt_failed":
      return "Synapse couldn’t decrypt this backup. It may be damaged.";
    default:
      return "Synapse couldn’t unlock this backup.";
  }
}

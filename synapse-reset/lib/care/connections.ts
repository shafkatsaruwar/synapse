/**
 * Local Care Connections. A connection is a record on this phone saying "I exchanged verified
 * keys with this person and chose what I may export to them". It is never a live session, and
 * nothing here touches the network. Private keys live only in the iOS Keychain.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import {
  createAcceptance, createInvitation, fingerprint, fromBase64Url, generateIdentity, identityFromSecrets, parseAcceptance,
  parseInvitation, setRandomSource, toBase64Url, verificationCode, type DeviceIdentity, type Invitation, type InvitationRelationship,
} from "./crypto";
import { CARE_KEY_PREFIX } from "./profiles";
import { CARE_SCHEMA_VERSION, EDITABLE_CATEGORIES, type CareConnection, type ConnectionRole, type SharingCategory, type SharingPermission } from "./types";

setRandomSource((n) => Crypto.getRandomBytes(n));

const IDENTITY_KEY = "synapse_care_identity_v1";
export const CONNECTIONS_KEY = `${CARE_KEY_PREFIX}connections_v1`;
const SEEN_KEY = `${CARE_KEY_PREFIX}seen_v1`;
const MAX_SEEN = 500;

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

// ---------- identity (Keychain) ----------

let cachedIdentity: DeviceIdentity | null = null;

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (cachedIdentity) return cachedIdentity;
  const stored = await SecureStore.getItemAsync(IDENTITY_KEY);
  if (stored) {
    try {
      const { s, a } = JSON.parse(stored) as { s: string; a: string };
      cachedIdentity = identityFromSecrets(fromBase64Url(s), fromBase64Url(a));
      return cachedIdentity;
    } catch {
      // Fall through and mint a new identity; existing connections will show "needs verification".
    }
  }
  const fresh = generateIdentity();
  await SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify({ s: toBase64Url(fresh.signSecret), a: toBase64Url(fresh.agreeSecret) }), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  cachedIdentity = fresh;
  return fresh;
}

export async function getMyFingerprint(): Promise<string> {
  return fingerprint((await getDeviceIdentity()).signPublic);
}

/** Test hook: forget the in-memory identity so the next call re-reads the Keychain. */
export function resetIdentityCacheForTests(): void {
  cachedIdentity = null;
}

/** Used by "Reset app". Removes the private keys from the Keychain. */
export async function deleteDeviceIdentity(): Promise<void> {
  cachedIdentity = null;
  try {
    await SecureStore.deleteItemAsync(IDENTITY_KEY);
  } catch {
    // Already gone.
  }
}

// ---------- storage ----------

function sanitizeConnection(c: Partial<CareConnection>): CareConnection | null {
  if (!c || typeof c.id !== "string" || typeof c.inviteId !== "string") return null;
  const now = new Date().toISOString();
  return {
    id: c.id,
    schemaVersion: CARE_SCHEMA_VERSION,
    peerName: (c.peerName ?? "").toString().slice(0, 60) || "Someone",
    role: c.role === "i_care_for_them" || c.role === "they_care_for_me" ? c.role : "peers",
    state: c.state ?? "needs_verification",
    inviteId: c.inviteId,
    invitationJson: c.state === "invitation_created" ? c.invitationJson : undefined,
    peerSignPublic: c.peerSignPublic,
    peerAgreePublic: c.peerAgreePublic,
    peerTimeZone: c.peerTimeZone,
    grants: Array.isArray(c.grants) ? c.grants.filter((g): g is SharingPermission => !!g && typeof g.category === "string").map((g) => ({ category: g.category, access: g.access === "edit" ? ("edit" as const) : ("view" as const) })) : [],
    theyRequested: Array.isArray(c.theyRequested) ? c.theyRequested : [],
    referenceProfileId: c.referenceProfileId,
    profileId: c.profileId,
    guardianClaim: c.guardianClaim === "self_declared" ? "self_declared" : "none",
    verifiedAt: c.verifiedAt,
    lastImportAt: c.lastImportAt,
    lastExportAt: c.lastExportAt,
    createdAt: c.createdAt ?? now,
    updatedAt: c.updatedAt ?? now,
    revokedAt: c.revokedAt,
  };
}

export async function loadConnections(): Promise<CareConnection[]> {
  try {
    const raw = await AsyncStorage.getItem(CONNECTIONS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Partial<CareConnection>[];
    return Array.isArray(list) ? list.map(sanitizeConnection).filter((c): c is CareConnection => c !== null) : [];
  } catch {
    return [];
  }
}

async function saveConnections(list: CareConnection[]): Promise<void> {
  await AsyncStorage.setItem(CONNECTIONS_KEY, JSON.stringify(list));
}

function mutate<T>(fn: (list: CareConnection[]) => { list: CareConnection[]; result: T }): Promise<T> {
  return serial(async () => {
    const { list, result } = fn(await loadConnections());
    await saveConnections(list);
    return result;
  });
}

type Seen = { invites: string[]; packages: string[] };

async function loadSeen(): Promise<Seen> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<Seen>) : {};
    return { invites: Array.isArray(p.invites) ? p.invites : [], packages: Array.isArray(p.packages) ? p.packages : [] };
  } catch {
    return { invites: [], packages: [] };
  }
}

export function markSeen(kind: "invites" | "packages", id: string): Promise<void> {
  return serial(async () => {
    const seen = await loadSeen();
    if (!seen[kind].includes(id)) seen[kind] = [...seen[kind], id].slice(-MAX_SEEN);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  });
}

export async function loadSeenPackageIds(): Promise<Set<string>> {
  return new Set((await loadSeen()).packages);
}

// ---------- invitation encoding ----------

export const INVITE_LINK_PREFIX = "synapse://care/invite?d=";
export const ACCEPT_LINK_PREFIX = "synapse://care/accept?d=";

const te = new TextEncoder();
const td = new TextDecoder();

export function encodeLink(prefix: string, message: object): string {
  return prefix + toBase64Url(te.encode(JSON.stringify(message)));
}

/** Accepts a synapse:// link, a bare code, or raw JSON (from a file). Returns the JSON text. */
export function extractJsonFromInput(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (text.startsWith("{")) return text;
  const match = /[?&]d=([A-Za-z0-9_-]+)/.exec(text);
  const code = match ? match[1] : /^[A-Za-z0-9_-]+$/.test(text) ? text : null;
  if (!code) return null;
  try {
    return td.decode(fromBase64Url(code));
  } catch {
    return null;
  }
}

export function detectCareMessageKind(input: string): "invite" | "accept" | "package" | null {
  const json = extractJsonFromInput(input);
  if (!json) return null;
  try {
    const t = (JSON.parse(json) as { t?: string }).t;
    return t === "invite" || t === "accept" || t === "package" ? t : null;
  } catch {
    return null;
  }
}

// ---------- outgoing invitation ----------

const REL_TO_INVITE: Record<ConnectionRole, InvitationRelationship> = {
  i_care_for_them: "cared_for",
  they_care_for_me: "caregiver",
  peers: "peer",
};

const INVITE_TO_ROLE: Record<InvitationRelationship, ConnectionRole> = {
  caregiver: "they_care_for_me",
  cared_for: "i_care_for_them",
  peer: "peers",
};

export async function createOutgoingInvitation(input: {
  myName: string;
  myTimeZone: string;
  role: ConnectionRole;
  requests: SharingCategory[];
  profileId?: string;
}): Promise<{ connection: CareConnection; invitation: Invitation; link: string }> {
  const identity = await getDeviceIdentity();
  const invitation = createInvitation(identity, {
    name: input.myName,
    relationship: REL_TO_INVITE[input.role],
    requests: input.requests,
    timeZone: input.myTimeZone,
  });
  const now = new Date().toISOString();
  const connection: CareConnection = {
    id: Crypto.randomUUID().replace(/-/g, "").slice(0, 20),
    schemaVersion: CARE_SCHEMA_VERSION,
    peerName: "Waiting for reply",
    role: input.role,
    state: "invitation_created",
    inviteId: invitation.id,
    invitationJson: JSON.stringify(invitation),
    grants: [],
    theyRequested: [],
    profileId: input.profileId,
    guardianClaim: "none",
    createdAt: now,
    updatedAt: now,
  };
  await mutate((list) => ({ list: [...list, connection], result: undefined }));
  return { connection, invitation, link: encodeLink(INVITE_LINK_PREFIX, invitation) };
}

// ---------- incoming invitation ----------

export type InvitationPreview =
  | { ok: true; invitation: Invitation; fingerprint: string; alreadyHandled: boolean; ownInvitation: boolean }
  | { ok: false; reason: "malformed" | "expired" | "bad_signature" | "unsupported_version" };

export async function previewInvitation(input: string): Promise<InvitationPreview> {
  const json = extractJsonFromInput(input);
  if (!json) return { ok: false, reason: "malformed" };
  const parsed = parseInvitation(json);
  if (!parsed.ok) return parsed;
  const [seen, identity] = await Promise.all([loadSeen(), getDeviceIdentity()]);
  const mine = parsed.value.sp === toBase64Url(identity.signPublic);
  return {
    ok: true,
    invitation: parsed.value,
    fingerprint: fingerprint(fromBase64Url(parsed.value.sp)),
    alreadyHandled: seen.invites.includes(parsed.value.id),
    ownInvitation: mine,
  };
}

export async function rejectInvitation(invitation: Invitation): Promise<void> {
  await markSeen("invites", invitation.id);
}

/** Accepting creates a connection that is NOT trusted until the verification code is confirmed. */
export async function acceptInvitation(
  invitation: Invitation,
  input: { myName: string; myTimeZone: string; grants: SharingCategory[]; profileId?: string },
): Promise<{ connection: CareConnection; replyLink: string }> {
  const identity = await getDeviceIdentity();
  const reply = createAcceptance(identity, invitation, { name: input.myName, timeZone: input.myTimeZone });
  const now = new Date().toISOString();
  const connection: CareConnection = {
    id: Crypto.randomUUID().replace(/-/g, "").slice(0, 20),
    schemaVersion: CARE_SCHEMA_VERSION,
    peerName: invitation.name,
    role: INVITE_TO_ROLE[invitation.relationship],
    state: "awaiting_confirmation",
    inviteId: invitation.id,
    peerSignPublic: invitation.sp,
    peerAgreePublic: invitation.ap,
    peerTimeZone: invitation.timeZone,
    grants: input.grants.map((category) => ({ category, access: "view" as const })),
    theyRequested: invitation.requests as SharingCategory[],
    profileId: input.profileId,
    guardianClaim: "none",
    createdAt: now,
    updatedAt: now,
  };
  await mutate((list) => ({ list: [...list, connection], result: undefined }));
  await markSeen("invites", invitation.id);
  return { connection, replyLink: encodeLink(ACCEPT_LINK_PREFIX, reply) };
}

/** Inviter side: apply the other person's signed reply to the matching pending invitation. */
export async function completeWithAcceptance(input: string): Promise<{ ok: true; connection: CareConnection } | { ok: false; reason: string }> {
  const json = extractJsonFromInput(input);
  if (!json) return { ok: false, reason: "malformed" };
  let inviteId: string;
  try {
    inviteId = (JSON.parse(json) as { inviteId?: string }).inviteId ?? "";
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const identity = await getDeviceIdentity();
  const parsed = parseAcceptance(json, inviteId, identity.signPublic);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  const accept = parsed.value;
  type Outcome = { ok: true; connection: CareConnection } | { ok: false; reason: string };
  return mutate<Outcome>((list) => {
    const target = list.find((c) => c.inviteId === accept.inviteId && c.state === "invitation_created");
    if (!target) return { list, result: { ok: false, reason: "no_matching_invitation" } };
    const updated: CareConnection = {
      ...target,
      peerName: accept.name,
      peerSignPublic: accept.sp,
      peerAgreePublic: accept.ap,
      peerTimeZone: accept.timeZone,
      state: "awaiting_confirmation",
      updatedAt: new Date().toISOString(),
    };
    return { list: list.map((c) => (c.id === target.id ? updated : c)), result: { ok: true, connection: updated } };
  });
}

// ---------- verification & permissions ----------

export async function getVerificationCode(conn: CareConnection): Promise<string | null> {
  if (!conn.peerSignPublic || !conn.peerAgreePublic) return null;
  const me = await getDeviceIdentity();
  return verificationCode(me, { signPublic: fromBase64Url(conn.peerSignPublic), agreePublic: fromBase64Url(conn.peerAgreePublic) });
}

export function confirmVerification(id: string, codesMatch: boolean): Promise<void> {
  return mutate((list) => ({
    list: list.map((c) =>
      c.id !== id || c.state === "revoked" || c.state === "removed"
        ? c
        : codesMatch
          ? { ...c, state: "connected_locally" as const, verifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : { ...c, state: "needs_verification" as const, verifiedAt: undefined, grants: [], updatedAt: new Date().toISOString() },
    ),
    result: undefined,
  }));
}

/**
 * What I allow this person to receive (and, for some categories, to propose changes to).
 * Accepts plain categories for view-only, or {category, access}. Edit is only honoured for
 * categories that support it.
 */
export function setGrants(id: string, grants: (SharingCategory | { category: SharingCategory; access: "view" | "edit" })[]): Promise<void> {
  const normalised: SharingPermission[] = grants.map((g) => {
    const category = typeof g === "string" ? g : g.category;
    const wantsEdit = typeof g !== "string" && g.access === "edit" && EDITABLE_CATEGORIES.includes(category);
    return { category, access: wantsEdit ? "edit" : "view" };
  });
  return mutate((list) => ({
    list: list.map((c) => (c.id === id && c.state === "connected_locally" ? { ...c, grants: normalised, updatedAt: new Date().toISOString() } : c)),
    result: undefined,
  }));
}

export function setGuardianClaim(id: string, claim: "none" | "self_declared"): Promise<void> {
  return mutate((list) => ({ list: list.map((c) => (c.id === id ? { ...c, guardianClaim: claim, updatedAt: new Date().toISOString() } : c)), result: undefined }));
}

export function linkConnectionProfile(id: string, patch: { profileId?: string; referenceProfileId?: string }): Promise<void> {
  return mutate((list) => ({ list: list.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c)), result: undefined }));
}

export function recordConnectionTransfer(id: string, kind: "import" | "export"): Promise<void> {
  const at = new Date().toISOString();
  return mutate((list) => ({
    list: list.map((c) => (c.id === id ? { ...c, ...(kind === "import" ? { lastImportAt: at } : { lastExportAt: at }) } : c)),
    result: undefined,
  }));
}

/**
 * Stops new exports and forgets the peer's key. Without a server we cannot reach their phone, so
 * anything already shared stays on it. The UI says so.
 */
export function revokeConnection(id: string): Promise<void> {
  const at = new Date().toISOString();
  return mutate((list) => ({
    list: list.map((c) =>
      c.id === id ? { ...c, state: "revoked" as const, grants: [], peerAgreePublic: undefined, revokedAt: at, updatedAt: at } : c,
    ),
    result: undefined,
  }));
}

export async function removeConnection(id: string): Promise<void> {
  await mutate((list) => ({ list: list.filter((c) => c.id !== id), result: undefined }));
  try {
    await AsyncStorage.removeItem(`${CARE_KEY_PREFIX}shared_v1_${id}`);
  } catch {
    // Nothing stored.
  }
}

/** Trusted means: verified by both people reading the code aloud, and not revoked. */
export function isTrusted(c: CareConnection): boolean {
  return c.state === "connected_locally" && !!c.peerSignPublic && !!c.peerAgreePublic;
}


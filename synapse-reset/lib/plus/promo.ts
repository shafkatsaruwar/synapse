/**
 * Synapse Plus promotional offer redemption.
 *
 * Offer secrets are stored only as salted digests — never as plaintext in source.
 * Redemption is device-local (SecureStore when available).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const PROMO_SALT = "synapse.plus.promo.v1";
const REDEEMED_KEY = "synapse_plus_promo_lifetime_v1";

/**
 * Accepted promotional offer digests (SHA-256 of `${PROMO_SALT}:${normalizedCode}`).
 * Add new holiday offers by appending digests only — never commit plaintext codes.
 */
const ACCEPTED_OFFER_DIGESTS: readonly string[] = [
  "3851d4cd2ff959fb25d69bc7f0be98e346724f98670a89d88e0d02ee0a1f6a71",
];

export type PromoRedeemResult =
  | { ok: true; alreadyRedeemed?: boolean }
  | { ok: false; reason: "empty" | "invalid" | "storage" };

function normalizePromoInput(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

async function digestOfferInput(normalized: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${PROMO_SALT}:${normalized}`
  );
}

function digestsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function isAcceptedDigest(digest: string): Promise<boolean> {
  for (const accepted of ACCEPTED_OFFER_DIGESTS) {
    if (digestsEqual(digest, accepted)) return true;
  }
  return false;
}

async function readRedeemedRaw(): Promise<string | null> {
  try {
    if (Platform.OS === "ios" || Platform.OS === "android") {
      const secure = await SecureStore.getItemAsync(REDEEMED_KEY);
      if (secure) return secure;
    }
  } catch {
    // fall through
  }
  try {
    return await AsyncStorage.getItem(REDEEMED_KEY);
  } catch {
    return null;
  }
}

async function writeRedeemedRaw(value: string): Promise<boolean> {
  let ok = false;
  try {
    if (Platform.OS === "ios" || Platform.OS === "android") {
      await SecureStore.setItemAsync(REDEEMED_KEY, value);
      ok = true;
    }
  } catch {
    // fall through to AsyncStorage
  }
  try {
    await AsyncStorage.setItem(REDEEMED_KEY, value);
    ok = true;
  } catch {
    // keep prior ok
  }
  return ok;
}

export async function hasRedeemedPromoLifetime(): Promise<boolean> {
  const raw = await readRedeemedRaw();
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { active?: boolean };
    return parsed.active === true;
  } catch {
    return raw === "true";
  }
}

/** Validate and permanently unlock lifetime Plus on this device. */
export async function redeemPromoCode(rawCode: string): Promise<PromoRedeemResult> {
  const normalized = normalizePromoInput(rawCode);
  if (!normalized) return { ok: false, reason: "empty" };

  if (await hasRedeemedPromoLifetime()) {
    return { ok: true, alreadyRedeemed: true };
  }

  const digest = await digestOfferInput(normalized);
  if (!(await isAcceptedDigest(digest))) {
    return { ok: false, reason: "invalid" };
  }

  const payload = JSON.stringify({
    active: true,
    redeemedAt: new Date().toISOString(),
    offer: "lifetime",
  });
  const saved = await writeRedeemedRaw(payload);
  if (!saved) return { ok: false, reason: "storage" };
  return { ok: true };
}

export async function clearPromoRedemptionForTests(): Promise<void> {
  try {
    if (Platform.OS === "ios" || Platform.OS === "android") {
      await SecureStore.deleteItemAsync(REDEEMED_KEY);
    }
  } catch {}
  try {
    await AsyncStorage.removeItem(REDEEMED_KEY);
  } catch {}
}

/**
 * Local key material for encrypted CloudKit backups.
 *
 * - Raw DEK lives only in the device Keychain (SecureStore, THIS_DEVICE_ONLY).
 * - Wrapped DEK metadata (salt + ciphertext) is stored locally so this device can
 *   keep wrapping new snapshots without re-prompting, and is also embedded in each
 *   CloudKit envelope for cross-device recovery via the user passphrase.
 * - Never logs passphrase or DEK bytes.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  generateBackupDek,
  type CloudKitWrappedDek,
  validatePassphraseConfirmation,
  wrapDek,
  unwrapDek,
  passphraseFailureMessage,
  type PassphraseFailure,
} from "@/lib/cloudkit-crypto";
import { fromBase64Url, toBase64Url } from "@/lib/care/crypto";

const DEK_SECURE_KEY = "synapse_cloudkit_dek_v1";
const WRAP_ASYNC_KEY = "synapse_cloudkit_wrap_v1";
const AUTO_ENABLED_KEY = "synapse_cloudkit_auto_backup_enabled_v1";
const RECOVERY_CONFIGURED_KEY = "synapse_cloudkit_recovery_configured_v1";

const secureOpts = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const;

export type CloudKitRecoveryStatus = {
  recoveryConfigured: boolean;
  autoBackupEnabled: boolean;
  dekPresent: boolean;
};

async function readWrap(): Promise<CloudKitWrappedDek | null> {
  try {
    const raw = await AsyncStorage.getItem(WRAP_ASYNC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CloudKitWrappedDek;
    if (!parsed || parsed.kdf !== "scrypt") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeWrap(wrap: CloudKitWrappedDek): Promise<void> {
  await AsyncStorage.setItem(WRAP_ASYNC_KEY, JSON.stringify(wrap));
  await AsyncStorage.setItem(RECOVERY_CONFIGURED_KEY, "1");
}

export async function getCloudKitRecoveryStatus(): Promise<CloudKitRecoveryStatus> {
  const [configured, auto, dek] = await Promise.all([
    AsyncStorage.getItem(RECOVERY_CONFIGURED_KEY).catch(() => null),
    AsyncStorage.getItem(AUTO_ENABLED_KEY).catch(() => null),
    SecureStore.getItemAsync(DEK_SECURE_KEY).catch(() => null),
  ]);
  return {
    recoveryConfigured: configured === "1" || Boolean(await readWrap()),
    autoBackupEnabled: auto === "1",
    dekPresent: typeof dek === "string" && dek.length > 0,
  };
}

export async function setCloudKitAutoBackupEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_ENABLED_KEY, enabled ? "1" : "0");
}

export async function getStoredBackupDek(): Promise<Uint8Array | null> {
  try {
    const encoded = await SecureStore.getItemAsync(DEK_SECURE_KEY);
    if (!encoded) return null;
    return fromBase64Url(encoded);
  } catch {
    return null;
  }
}

async function storeBackupDek(dek: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(DEK_SECURE_KEY, toBase64Url(dek), secureOpts);
}

/**
 * First-time setup: create DEK, wrap with passphrase, persist both.
 * Does not enable automatic backup by itself — caller flips that after success.
 */
export async function setupCloudKitRecoveryPassphrase(
  passphrase: string,
  confirmation: string,
): Promise<{ ok: true } | { ok: false; reason: PassphraseFailure; message: string }> {
  const issue = validatePassphraseConfirmation(passphrase, confirmation);
  if (issue) {
    return { ok: false, reason: issue, message: passphraseFailureMessage(issue) };
  }
  const dek = generateBackupDek();
  const wrap = await wrapDek(dek, passphrase);
  await storeBackupDek(dek);
  await writeWrap(wrap);
  return { ok: true };
}

/** Load DEK for encryption, or null if recovery was never set up on this device. */
export async function requireBackupDek(): Promise<Uint8Array | null> {
  return getStoredBackupDek();
}

export async function getStoredWrap(): Promise<CloudKitWrappedDek | null> {
  return readWrap();
}

/**
 * Unlock a CloudKit envelope's wrap with the recovery passphrase and cache the DEK
 * on this device for subsequent backups / restores.
 */
export async function unlockBackupWithPassphrase(
  wrap: CloudKitWrappedDek,
  passphrase: string,
): Promise<{ ok: true; dek: Uint8Array } | { ok: false; reason: PassphraseFailure; message: string }> {
  const result = await unwrapDek(wrap, passphrase);
  if (!result.ok) {
    return { ok: false, reason: result.reason, message: passphraseFailureMessage(result.reason) };
  }
  await storeBackupDek(result.dek);
  await writeWrap(wrap);
  return { ok: true, dek: result.dek };
}

/** Clears local DEK / wrap / auto flag. Does not delete CloudKit records. */
export async function clearLocalCloudKitKeyMaterial(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DEK_SECURE_KEY);
  } catch {
    // Best-effort.
  }
  try {
    await AsyncStorage.multiRemove([WRAP_ASYNC_KEY, RECOVERY_CONFIGURED_KEY, AUTO_ENABLED_KEY]);
  } catch {
    // Best-effort.
  }
}

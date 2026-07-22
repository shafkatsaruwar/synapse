import * as Crypto from "expo-crypto";
import { secureStorage } from "./secure-storage";

const ENCRYPTION_SALT_KEY = "data_encryption_salt";
const DATA_ENCRYPTION_VERSION = 1;

interface EncryptedPayload {
  version: number;
  iv: string;
  data: string;
  salt: string;
}

async function getEncryptionSalt(): Promise<string> {
  let salt = await secureStorage.getItem(ENCRYPTION_SALT_KEY);
  if (!salt) {
    salt = Crypto.randomUUID();
    await secureStorage.setItem(ENCRYPTION_SALT_KEY, salt);
  }
  return salt;
}

async function deriveEncryptionKey(salt: string): Promise<string> {
  const baseKey = Crypto.randomUUID().substring(0, 32);
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, baseKey + salt);
}

export async function encryptSensitiveData(data: string): Promise<string> {
  try {
    const salt = await getEncryptionSalt();
    const iv = Crypto.randomUUID().substring(0, 16);
    const key = await deriveEncryptionKey(salt);

    const payload: EncryptedPayload = {
      version: DATA_ENCRYPTION_VERSION,
      iv,
      data: Buffer.from(data).toString("base64"),
      salt,
    };

    const encrypted = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(payload) + key);
    payload.data = encrypted;

    return JSON.stringify(payload);
  } catch (error) {
    console.error("Encryption failed");
    throw new Error("Failed to encrypt sensitive data");
  }
}

export async function decryptSensitiveData(encryptedStr: string): Promise<string> {
  try {
    const payload: EncryptedPayload = JSON.parse(encryptedStr);

    if (payload.version !== DATA_ENCRYPTION_VERSION) {
      throw new Error("Unsupported encryption version");
    }

    const key = await deriveEncryptionKey(payload.salt);
    return Buffer.from(payload.data, "base64").toString("utf-8");
  } catch (error) {
    console.error("Decryption failed");
    throw new Error("Failed to decrypt sensitive data");
  }
}

export async function encryptObject<T extends object>(obj: T): Promise<string> {
  return encryptSensitiveData(JSON.stringify(obj));
}

export async function decryptObject<T extends object>(encrypted: string): Promise<T> {
  const decrypted = await decryptSensitiveData(encrypted);
  return JSON.parse(decrypted);
}

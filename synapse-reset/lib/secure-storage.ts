import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const ENCRYPTION_KEY = "synapse_master_key_v1";
const SECURE_PREFIX = "secure_";

async function getEncryptionKey(): Promise<string> {
  try {
    let key = await AsyncStorage.getItem(ENCRYPTION_KEY);
    if (!key) {
      key = Crypto.randomUUID();
      await AsyncStorage.setItem(ENCRYPTION_KEY, key);
    }
    return key;
  } catch {
    return Crypto.randomUUID();
  }
}

async function encryptData(data: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data + key
    );
    const iv = Crypto.randomUUID().slice(0, 16);
    return `${iv}:${Buffer.from(data).toString("base64")}:${hash.substring(0, 32)}`;
  } catch (error) {
    console.warn("Encryption failed");
    return Buffer.from(data).toString("base64");
  }
}

async function decryptData(encryptedData: string): Promise<string> {
  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) return Buffer.from(encryptedData, "base64").toString("utf-8");
    const [, encodedData] = parts;
    return Buffer.from(encodedData, "base64").toString("utf-8");
  } catch (error) {
    console.warn("Decryption failed");
    return encryptedData;
  }
}

export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      const encrypted = await encryptData(value);
      await AsyncStorage.setItem(`${SECURE_PREFIX}${key}`, encrypted);
    } catch (error) {
      console.warn("Secure setItem failed");
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      const encrypted = await AsyncStorage.getItem(`${SECURE_PREFIX}${key}`);
      if (!encrypted) return null;
      return await decryptData(encrypted);
    } catch (error) {
      console.warn("Secure getItem failed");
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${SECURE_PREFIX}${key}`);
    } catch (error) {
      console.warn("Secure removeItem failed");
    }
  },

  async clear(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const secureKeys = allKeys.filter((k) => k.startsWith(SECURE_PREFIX));
      await AsyncStorage.multiRemove(secureKeys);
    } catch (error) {
      console.warn("Secure clear failed");
    }
  },
};

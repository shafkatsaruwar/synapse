/** Test-only: in-memory stand-ins for native modules so storage code can run under Node. */
import Module from "node:module";
import { randomUUID, createHash, randomBytes } from "node:crypto";

export const memory = new Map<string, string>();

const AsyncStorageMock = {
  getItem: async (k: string) => (memory.has(k) ? memory.get(k)! : null),
  setItem: async (k: string, v: string) => void memory.set(k, v),
  removeItem: async (k: string) => void memory.delete(k),
  multiSet: async (pairs: [string, string][]) => pairs.forEach(([k, v]) => memory.set(k, v)),
  multiRemove: async (keys: string[]) => keys.forEach((k) => memory.delete(k)),
  getAllKeys: async () => [...memory.keys()],
};

export const secure = new Map<string, string>();
const devices: Record<string, { memory: Map<string, string>; secure: Map<string, string> }> = {};
let currentDevice = "default";

/** Wipes every simulated phone. */
export function resetAllDevices(): void {
  scheduled.clear();
  smsLog.length = 0;
  for (const k of Object.keys(devices)) delete devices[k];
  memory.clear();
  secure.clear();
  currentDevice = "default";
}

/** Switches the in-memory "phone": its own AsyncStorage and Keychain. */
export function useDevice(name: string): void {
  devices[currentDevice] = { memory: new Map(memory), secure: new Map(secure) };
  memory.clear();
  secure.clear();
  const next = devices[name];
  if (next) {
    next.memory.forEach((v, k) => memory.set(k, v));
    next.secure.forEach((v, k) => secure.set(k, v));
  }
  currentDevice = name;
}

export const scheduled = new Map<string, { identifier: string; content: Record<string, unknown>; trigger: { type: string; date?: Date; seconds?: number } }>();
export const smsLog: { to: string[]; body: string }[] = [];

const mocks: Record<string, unknown> = {
  "react-native": {
    Platform: { OS: "ios" },
    Linking: { openURL: async () => true },
    Share: { share: async () => ({ action: "sharedAction" }), dismissedAction: "dismissedAction" },
  },
  "expo-notifications": {
    SchedulableTriggerInputTypes: { DATE: "date", TIME_INTERVAL: "timeInterval" },
    setNotificationCategoryAsync: async () => {},
    getAllScheduledNotificationsAsync: async () => [...scheduled.values()],
    cancelScheduledNotificationAsync: async (id: string) => void scheduled.delete(id),
    scheduleNotificationAsync: async (req: { identifier: string; content: Record<string, unknown>; trigger: { type: string; date?: Date; seconds?: number } }) => {
      scheduled.set(req.identifier, req);
      return req.identifier;
    },
  },
  "expo-sms": { isAvailableAsync: async () => true, sendSMSAsync: async (to: string[], body: string) => void smsLog.push({ to, body }) },
  "expo-secure-store": {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "when_unlocked_this_device_only",
    getItemAsync: async (k: string) => (secure.has(k) ? secure.get(k)! : null),
    setItemAsync: async (k: string, v: string) => void secure.set(k, v),
    deleteItemAsync: async (k: string) => void secure.delete(k),
  },
  "@react-native-async-storage/async-storage": { default: AsyncStorageMock, ...AsyncStorageMock },
  "expo-crypto": {
    randomUUID,
    getRandomBytes: (n: number) => new Uint8Array(randomBytes(n)),
    digestStringAsync: async (_a: string, d: string) => createHash("sha256").update(d).digest("hex"),
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  },
  "@/lib/cloudkit-backup-scheduler": { markCloudKitBackupDirty: async () => {} },
};

const m = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
const original = m._load;
m._load = function (request: string, ...rest: unknown[]) {
  if (request in mocks) return mocks[request];
  return original.call(this, request, ...rest);
};

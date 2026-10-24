/** Test-only: in-memory stand-ins for native modules so storage code can run under Node. */
import Module from "node:module";
import { randomUUID, createHash } from "node:crypto";

export const memory = new Map<string, string>();

const AsyncStorageMock = {
  getItem: async (k: string) => (memory.has(k) ? memory.get(k)! : null),
  setItem: async (k: string, v: string) => void memory.set(k, v),
  removeItem: async (k: string) => void memory.delete(k),
  multiSet: async (pairs: [string, string][]) => pairs.forEach(([k, v]) => memory.set(k, v)),
  multiRemove: async (keys: string[]) => keys.forEach((k) => memory.delete(k)),
  getAllKeys: async () => [...memory.keys()],
};

const mocks: Record<string, unknown> = {
  "@react-native-async-storage/async-storage": { default: AsyncStorageMock, ...AsyncStorageMock },
  "expo-crypto": {
    randomUUID,
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

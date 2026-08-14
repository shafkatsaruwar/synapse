import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { vitalStorage, type Vital } from "@/lib/storage";

const CONNECTED_KEY = "synapse_apple_health_connected_v1";
const LAST_SYNC_KEY = "synapse_apple_health_last_sync_v1";

const READ_TYPES = [
  "HKQuantityTypeIdentifierHeartRate",
  "HKQuantityTypeIdentifierBodyMass",
  "HKQuantityTypeIdentifierBodyTemperature",
  "HKQuantityTypeIdentifierOxygenSaturation",
  "HKQuantityTypeIdentifierBloodGlucose",
  "HKCorrelationTypeIdentifierBloodPressure",
  "HKQuantityTypeIdentifierStepCount",
  "HKCategoryTypeIdentifierSleepAnalysis",
] as const;

/** HKCategoryValueSleepAnalysis values that represent actual sleep (excludes inBed=0, awake=2). */
const ASLEEP_CATEGORY_VALUES = new Set([1, 3, 4, 5]);

export type AppleHealthStatus = {
  available: boolean;
  connected: boolean;
  lastSyncAt: string | null;
  platformSupported: boolean;
  reason?: string;
};

function toDateKey(value: Date | string | number | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function toIso(value: Date | string | number | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

async function loadHealthKit(): Promise<typeof import("@kingstinct/react-native-healthkit") | null> {
  if (Platform.OS !== "ios") return null;
  try {
    // Dynamic import so web/Android/Expo Go don't crash on missing native module.
    return await import("@kingstinct/react-native-healthkit");
  } catch {
    return null;
  }
}

export async function getAppleHealthStatus(): Promise<AppleHealthStatus> {
  if (Platform.OS !== "ios") {
    return {
      available: false,
      connected: false,
      lastSyncAt: null,
      platformSupported: false,
      reason: "Apple Health is only available on iPhone and iPad.",
    };
  }

  const [connectedRaw, lastSyncAt] = await Promise.all([
    AsyncStorage.getItem(CONNECTED_KEY),
    AsyncStorage.getItem(LAST_SYNC_KEY),
  ]);
  const connected = connectedRaw === "1";

  const hk = await loadHealthKit();
  if (!hk) {
    return {
      available: false,
      connected,
      lastSyncAt,
      platformSupported: true,
      reason: "Apple Health needs a native iOS build (TestFlight / dev client). Expo Go cannot access HealthKit.",
    };
  }

  try {
    const available = typeof hk.isHealthDataAvailableAsync === "function"
      ? await hk.isHealthDataAvailableAsync()
      : hk.isHealthDataAvailable();
    return {
      available: Boolean(available),
      connected: Boolean(available) && connected,
      lastSyncAt,
      platformSupported: true,
      reason: available
        ? undefined
        : "HealthKit is not available on this device.",
    };
  } catch {
    return {
      available: false,
      connected,
      lastSyncAt,
      platformSupported: true,
      reason: "Apple Health needs a native iOS build (TestFlight / dev client). Expo Go cannot access HealthKit.",
    };
  }
}

export async function connectAppleHealth(): Promise<{ ok: boolean; error?: string }> {
  const status = await getAppleHealthStatus();
  if (!status.platformSupported) {
    return { ok: false, error: status.reason };
  }
  if (!status.available && status.reason) {
    return { ok: false, error: status.reason };
  }

  const hk = await loadHealthKit();
  if (!hk) {
    return {
      ok: false,
      error: "Apple Health needs a native iOS build (TestFlight / dev client). Expo Go cannot access HealthKit.",
    };
  }

  try {
    await hk.requestAuthorization({
      toRead: [...READ_TYPES],
      toShare: [],
    });
    await AsyncStorage.setItem(CONNECTED_KEY, "1");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not connect to Apple Health.";
    return { ok: false, error: message };
  }
}

export async function disconnectAppleHealth(): Promise<void> {
  await AsyncStorage.setItem(CONNECTED_KEY, "0");
}

type QuantityLike = {
  uuid?: string;
  quantity?: number;
  unit?: string;
  startDate?: Date | string;
  endDate?: Date | string;
};

async function upsertVital(input: Omit<Vital, "id"> & { externalId: string }) {
  const all = await vitalStorage.getAll();
  const existing = all.find((vital) => vital.externalId === input.externalId);
  if (existing) {
    await vitalStorage.update(existing.id, {
      date: input.date,
      recordedAt: input.recordedAt,
      type: input.type,
      value: input.value,
      unit: input.unit,
      source: "apple_health",
      bloodPressureSystolic: input.bloodPressureSystolic,
      bloodPressureDiastolic: input.bloodPressureDiastolic,
      heartRate: input.heartRate,
      bodyTemperature: input.bodyTemperature,
      oxygenSaturation: input.oxygenSaturation,
      notes: input.notes,
      externalId: input.externalId,
    });
    return "updated" as const;
  }
  await vitalStorage.save(input);
  return "created" as const;
}

async function syncQuantity(
  hk: typeof import("@kingstinct/react-native-healthkit"),
  identifier: string,
  mapSample: (sample: QuantityLike) => (Omit<Vital, "id"> & { externalId: string }) | null,
  from: Date,
): Promise<number> {
  const samples = await hk.queryQuantitySamples(identifier as never, {
    limit: 200,
    ascending: false,
    filter: {
      date: {
        startDate: from,
        endDate: new Date(),
      },
    },
  } as never);

  let count = 0;
  for (const sample of samples as QuantityLike[]) {
    const mapped = mapSample(sample);
    if (!mapped) continue;
    await upsertVital(mapped);
    count += 1;
  }
  return count;
}

export async function syncAppleHealthVitals(days = 30): Promise<{
  ok: boolean;
  imported: number;
  error?: string;
}> {
  const status = await getAppleHealthStatus();
  if (!status.available) {
    return { ok: false, imported: 0, error: status.reason || "Apple Health is unavailable." };
  }

  const hk = await loadHealthKit();
  if (!hk) {
    return {
      ok: false,
      imported: 0,
      error: "Apple Health needs a native iOS build (TestFlight / dev client).",
    };
  }

  if (!status.connected) {
    const connected = await connectAppleHealth();
    if (!connected.ok) {
      return { ok: false, imported: 0, error: connected.error };
    }
  }

  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let imported = 0;

  try {
    imported += await syncQuantity(
      hk,
      "HKQuantityTypeIdentifierHeartRate",
      (sample) => {
        if (typeof sample.quantity !== "number" || !sample.uuid) return null;
        const bpm = Math.round(sample.quantity);
        return {
          date: toDateKey(sample.startDate),
          recordedAt: toIso(sample.startDate),
          type: "heart_rate",
          value: String(bpm),
          unit: "bpm",
          source: "apple_health",
          heartRate: bpm,
          externalId: `apple_health:hr:${sample.uuid}`,
          notes: "Imported from Apple Health",
        };
      },
      from,
    );

    imported += await syncQuantity(
      hk,
      "HKQuantityTypeIdentifierBodyMass",
      (sample) => {
        if (typeof sample.quantity !== "number" || !sample.uuid) return null;
        const unit = sample.unit?.includes("lb") ? "lbs" : "kg";
        const value = Number(sample.quantity.toFixed(1));
        return {
          date: toDateKey(sample.startDate),
          recordedAt: toIso(sample.startDate),
          type: "weight",
          value: String(value),
          unit,
          source: "apple_health",
          externalId: `apple_health:weight:${sample.uuid}`,
          notes: "Imported from Apple Health",
        };
      },
      from,
    );

    imported += await syncQuantity(
      hk,
      "HKQuantityTypeIdentifierBodyTemperature",
      (sample) => {
        if (typeof sample.quantity !== "number" || !sample.uuid) return null;
        // HealthKit often stores °C; convert to °F for Synapse default.
        let tempF = sample.quantity;
        const unit = (sample.unit || "").toLowerCase();
        if (unit.includes("c") || tempF < 45) {
          tempF = (tempF * 9) / 5 + 32;
        }
        const rounded = Number(tempF.toFixed(1));
        return {
          date: toDateKey(sample.startDate),
          recordedAt: toIso(sample.startDate),
          type: "body_temperature",
          value: String(rounded),
          unit: "°F",
          source: "apple_health",
          bodyTemperature: rounded,
          externalId: `apple_health:temp:${sample.uuid}`,
          notes: "Imported from Apple Health",
        };
      },
      from,
    );

    imported += await syncQuantity(
      hk,
      "HKQuantityTypeIdentifierOxygenSaturation",
      (sample) => {
        if (typeof sample.quantity !== "number" || !sample.uuid) return null;
        // HealthKit SpO2 is often 0–1 fraction.
        const pct = sample.quantity <= 1 ? Math.round(sample.quantity * 100) : Math.round(sample.quantity);
        return {
          date: toDateKey(sample.startDate),
          recordedAt: toIso(sample.startDate),
          type: "oxygen_saturation",
          value: String(pct),
          unit: "%",
          source: "apple_health",
          oxygenSaturation: pct,
          externalId: `apple_health:spo2:${sample.uuid}`,
          notes: "Imported from Apple Health",
        };
      },
      from,
    );

    imported += await syncQuantity(
      hk,
      "HKQuantityTypeIdentifierBloodGlucose",
      (sample) => {
        if (typeof sample.quantity !== "number" || !sample.uuid) return null;
        const value = Number(sample.quantity.toFixed(1));
        const unit = (sample.unit || "").toLowerCase().includes("mmol") ? "mmol/L" : "mg/dL";
        return {
          date: toDateKey(sample.startDate),
          recordedAt: toIso(sample.startDate),
          type: "blood_sugar",
          value: String(value),
          unit,
          source: "apple_health",
          externalId: `apple_health:bg:${sample.uuid}`,
          notes: "Imported from Apple Health",
        };
      },
      from,
    );

    const correlations = await hk.queryCorrelationSamples("HKCorrelationTypeIdentifierBloodPressure", {
      limit: 100,
      ascending: false,
      filter: {
        date: {
          startDate: from,
          endDate: new Date(),
        },
      },
    });

    for (const correlation of correlations) {
      const objects = (correlation as { uuid?: string; objects?: QuantityLike[]; startDate?: Date | string }).objects ?? [];
      const systolic = objects.find((obj) => (obj as { quantityType?: string }).quantityType === "HKQuantityTypeIdentifierBloodPressureSystolic");
      const diastolic = objects.find((obj) => (obj as { quantityType?: string }).quantityType === "HKQuantityTypeIdentifierBloodPressureDiastolic");
      if (typeof systolic?.quantity !== "number" || typeof diastolic?.quantity !== "number") continue;
      const uuid = (correlation as { uuid?: string }).uuid;
      if (!uuid) continue;
      const sys = Math.round(systolic.quantity);
      const dia = Math.round(diastolic.quantity);
      await upsertVital({
        date: toDateKey((correlation as { startDate?: Date | string }).startDate),
        recordedAt: toIso((correlation as { startDate?: Date | string }).startDate),
        type: "blood_pressure",
        value: `${sys}/${dia}`,
        unit: "mmHg",
        source: "apple_health",
        bloodPressureSystolic: sys,
        bloodPressureDiastolic: dia,
        externalId: `apple_health:bp:${uuid}`,
        notes: "Imported from Apple Health",
      });
      imported += 1;
    }

    // Steps: use HealthKit's own day-bucketed cumulative sum rather than summing raw
    // samples, since raw samples double-count when iPhone and Apple Watch both log steps.
    const anchorDate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    const stepBuckets = await hk.queryStatisticsCollectionForQuantity(
      "HKQuantityTypeIdentifierStepCount" as never,
      ["cumulativeSum"],
      anchorDate,
      { day: 1 },
      { filter: { date: { startDate: from, endDate: new Date() } } } as never,
    );
    for (const bucket of stepBuckets as unknown as { sumQuantity?: { quantity: number }; startDate?: Date }[]) {
      const steps = bucket.sumQuantity?.quantity;
      if (typeof steps !== "number" || steps <= 0 || !bucket.startDate) continue;
      const dateKey = toDateKey(bucket.startDate);
      await upsertVital({
        date: dateKey,
        recordedAt: toIso(bucket.startDate),
        type: "steps",
        value: String(Math.round(steps)),
        unit: "steps",
        source: "apple_health",
        externalId: `apple_health:steps:${dateKey}`,
        notes: "Imported from Apple Health",
      });
      imported += 1;
    }

    // Sleep: HealthKit reports raw in-bed/asleep/awake segments per night, so sum the
    // asleep segments ourselves and attribute the total to the day the person woke up.
    const sleepSamples = await hk.queryCategorySamples("HKCategoryTypeIdentifierSleepAnalysis" as never, {
      limit: 500,
      ascending: true,
      filter: { date: { startDate: from, endDate: new Date() } },
    } as never);
    const sleepByDate = new Map<string, { minutes: number; latestEnd: Date }>();
    for (const sample of sleepSamples as { value?: number; startDate?: Date; endDate?: Date }[]) {
      if (typeof sample.value !== "number" || !ASLEEP_CATEGORY_VALUES.has(sample.value)) continue;
      if (!sample.startDate || !sample.endDate) continue;
      const start = new Date(sample.startDate).getTime();
      const end = new Date(sample.endDate).getTime();
      if (!(end > start)) continue;
      const dateKey = toDateKey(sample.endDate);
      const minutes = (end - start) / 60000;
      const existing = sleepByDate.get(dateKey);
      if (existing) {
        existing.minutes += minutes;
        if (end > existing.latestEnd.getTime()) existing.latestEnd = new Date(end);
      } else {
        sleepByDate.set(dateKey, { minutes, latestEnd: new Date(end) });
      }
    }
    for (const [dateKey, info] of sleepByDate) {
      const hours = Number((info.minutes / 60).toFixed(1));
      if (hours <= 0) continue;
      await upsertVital({
        date: dateKey,
        recordedAt: toIso(info.latestEnd),
        type: "sleep",
        value: String(hours),
        unit: "hours",
        source: "apple_health",
        externalId: `apple_health:sleep:${dateKey}`,
        notes: "Imported from Apple Health",
      });
      imported += 1;
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    await AsyncStorage.setItem(CONNECTED_KEY, "1");
    return { ok: true, imported };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apple Health sync failed.";
    return { ok: false, imported, error: message };
  }
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  healthLogStorage,
  symptomStorage,
  medicationLogStorage,
  vitalStorage,
  appointmentStorage,
  doctorNoteStorage,
  labWorkStorage,
  imagingStorage,
  cycleTrackingStorage,
} from "./storage";
import { auditLogger } from "./audit-logger";

export interface RetentionPolicy {
  entityType: string;
  retentionDays: number;
  enabled: boolean;
}

const DEFAULT_POLICIES: RetentionPolicy[] = [
  { entityType: "healthLog", retentionDays: 2 * 365, enabled: true },
  { entityType: "symptom", retentionDays: 2 * 365, enabled: true },
  { entityType: "medicationLog", retentionDays: 2 * 365, enabled: true },
  { entityType: "vital", retentionDays: 2 * 365, enabled: true },
  { entityType: "appointment", retentionDays: 2 * 365, enabled: true },
  { entityType: "doctorNote", retentionDays: 2 * 365, enabled: true },
  { entityType: "labWork", retentionDays: 5 * 365, enabled: true },
  { entityType: "imaging", retentionDays: 5 * 365, enabled: true },
  { entityType: "cycleTracking", retentionDays: 2 * 365, enabled: true },
];

const RETENTION_POLICIES_KEY = "data_retention_policies";
const LAST_CLEANUP_KEY = "last_data_retention_cleanup";

function getDateXDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function isDateOlderThan(dateStr: string, days: number): boolean {
  try {
    const date = new Date(dateStr);
    const cutoff = getDateXDaysAgo(days);
    return date < cutoff;
  } catch {
    return false;
  }
}

export const dataRetentionManager = {
  async getPolicies(): Promise<RetentionPolicy[]> {
    try {
      const raw = await AsyncStorage.getItem(RETENTION_POLICIES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RetentionPolicy[];
        return parsed.length > 0 ? parsed : DEFAULT_POLICIES;
      }
    } catch (error) {
      console.warn("Failed to read retention policies");
    }
    return DEFAULT_POLICIES;
  },

  async setPolicies(policies: RetentionPolicy[]): Promise<void> {
    try {
      await AsyncStorage.setItem(RETENTION_POLICIES_KEY, JSON.stringify(policies));
      await auditLogger.log("UPDATE", "user", "success", {
        details: "Data retention policies updated",
      });
    } catch (error) {
      console.error("Failed to save retention policies");
      await auditLogger.log("UPDATE", "user", "failure", {
        errorMessage: "Failed to save retention policies",
      });
    }
  },

  async cleanup(): Promise<void> {
    try {
      const policies = await this.getPolicies();
      const lastCleanup = await AsyncStorage.getItem(LAST_CLEANUP_KEY);

      const now = new Date();
      if (lastCleanup) {
        const last = new Date(lastCleanup);
        const hoursSinceLastCleanup = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastCleanup < 24) {
          return;
        }
      }

      let deletedCount = 0;

      for (const policy of policies) {
        if (!policy.enabled) continue;

        switch (policy.entityType) {
          case "healthLog": {
            const logs = await healthLogStorage.getAll();
            for (const log of logs) {
              if (isDateOlderThan(log.date, policy.retentionDays)) {
                await healthLogStorage.delete(log.id);
                deletedCount++;
              }
            }
            break;
          }

          case "symptom": {
            const symptoms = await symptomStorage.getAll();
            for (const symptom of symptoms) {
              if (isDateOlderThan(symptom.date, policy.retentionDays)) {
                await symptomStorage.delete(symptom.id);
                deletedCount++;
              }
            }
            break;
          }

          case "vital": {
            const vitals = await vitalStorage.getAll();
            for (const vital of vitals) {
              if (isDateOlderThan(vital.date, policy.retentionDays)) {
                await vitalStorage.delete(vital.id);
                deletedCount++;
              }
            }
            break;
          }

          case "cycleTracking": {
            const entries = await cycleTrackingStorage.getAll();
            for (const entry of entries) {
              if (isDateOlderThan(entry.date, policy.retentionDays)) {
                await cycleTrackingStorage.delete(entry.id);
                deletedCount++;
              }
            }
            break;
          }
        }
      }

      await AsyncStorage.setItem(LAST_CLEANUP_KEY, new Date().toISOString());

      if (deletedCount > 0) {
        await auditLogger.log("DELETE", "user", "success", {
          details: `Data retention cleanup: ${deletedCount} records deleted`,
        });
      }
    } catch (error) {
      console.error("Data retention cleanup failed");
      await auditLogger.log("DELETE", "user", "failure", {
        errorMessage: "Data retention cleanup failed",
      });
    }
  },

  async resetPolicies(): Promise<void> {
    await this.setPolicies(DEFAULT_POLICIES);
  },
};

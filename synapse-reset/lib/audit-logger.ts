import AsyncStorage from "@react-native-async-storage/async-storage";

export type AuditAction = "CREATE" | "READ" | "UPDATE" | "DELETE" | "EXPORT" | "IMPORT" | "AUTH" | "ERROR";
export type AuditEntity = "medication" | "appointment" | "doctor" | "health_log" | "vital" | "symptom" | "user" | "auth";

export interface AuditLog {
  id: string;
  timestamp: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  userId?: string;
  details?: string;
  status: "success" | "failure";
  errorMessage?: string;
}

const AUDIT_KEY = "audit_logs";
const MAX_LOGS = 10000;
const LOG_RETENTION_DAYS = 90;

function sanitizeDetails(details: any): string {
  if (typeof details === "string") {
    return details.substring(0, 500);
  }
  if (typeof details === "object") {
    const sanitized = { ...details };
    delete sanitized.password;
    delete sanitized.token;
    return JSON.stringify(sanitized).substring(0, 500);
  }
  return "";
}

export const auditLogger = {
  async log(
    action: AuditAction,
    entity: AuditEntity,
    status: "success" | "failure",
    options?: {
      entityId?: string;
      userId?: string;
      details?: any;
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      const logs = await this.getLogs();
      const newLog: AuditLog = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString(),
        action,
        entity,
        entityId: options?.entityId,
        userId: options?.userId || "anonymous",
        details: sanitizeDetails(options?.details),
        status,
        errorMessage: options?.errorMessage?.substring(0, 200),
      };

      logs.push(newLog);

      if (logs.length > MAX_LOGS) {
        logs.splice(0, logs.length - MAX_LOGS);
      }

      await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error("Audit logging failed - this should not block operations", error);
    }
  },

  async getLogs(): Promise<AuditLog[]> {
    try {
      const raw = await AsyncStorage.getItem(AUDIT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.warn("Failed to read audit logs", error);
      return [];
    }
  },

  async getLogsByEntity(entity: AuditEntity): Promise<AuditLog[]> {
    const logs = await this.getLogs();
    return logs.filter((log) => log.entity === entity);
  },

  async getLogsByAction(action: AuditAction): Promise<AuditLog[]> {
    const logs = await this.getLogs();
    return logs.filter((log) => log.action === action);
  },

  async getLogsForUser(userId: string): Promise<AuditLog[]> {
    const logs = await this.getLogs();
    return logs.filter((log) => log.userId === userId);
  },

  async getLogsSince(date: Date): Promise<AuditLog[]> {
    const logs = await this.getLogs();
    const timestamp = date.toISOString();
    return logs.filter((log) => log.timestamp >= timestamp);
  },

  async cleanupOldLogs(): Promise<void> {
    try {
      const logs = await this.getLogs();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);
      const filtered = logs.filter((log) => new Date(log.timestamp) > cutoffDate);
      await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.warn("Audit log cleanup failed", error);
    }
  },

  async exportLogs(): Promise<AuditLog[]> {
    try {
      const logs = await this.getLogs();
      await this.log("EXPORT", "user", "success", {
        details: `Exported ${logs.length} audit logs`,
      });
      return logs;
    } catch (error) {
      console.error("Audit log export failed", error);
      return [];
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AUDIT_KEY);
    } catch (error) {
      console.error("Audit log clear failed", error);
    }
  },
};

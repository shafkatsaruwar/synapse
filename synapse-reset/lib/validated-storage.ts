import {
  medicationStorage as rawMedicationStorage,
  doctorsStorage as rawDoctorsStorage,
  appointmentStorage as rawAppointmentStorage,
  medicationLogStorage as rawMedicationLogStorage,
  Medication,
  Doctor,
  Appointment,
  MedicationLog,
  RecordOwner,
} from "./storage";
import {
  MedicationSchema,
  DoctorSchema,
  AppointmentSchema,
  validateInput,
} from "./validation";
import { auditLogger } from "./audit-logger";

function sanitizeString(value: unknown, maxLength: number = 500): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, "");
}

function sanitizePhone(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const sanitized = value.trim();
  if (!/^[\d\-\+\(\)\s]{0,20}$/.test(sanitized)) return undefined;
  return sanitized || undefined;
}

export const validatedMedicationStorage = {
  async save(med: Omit<Medication, "id">) {
    try {
      const sanitized = {
        ...med,
        name: sanitizeString(med.name, 200),
        dosage: sanitizeString(med.dosage, 100),
        frequency: sanitizeString(med.frequency, 100),
        pharmacyName: sanitizeString(med.pharmacyName, 200),
        pharmacyPhone: sanitizePhone(med.pharmacyPhone),
      };

      const validated = validateInput(MedicationSchema, {
        id: "temp",
        ...sanitized,
      });

      const result = await rawMedicationStorage.save(sanitized);

      await auditLogger.log("CREATE", "medication", "success", {
        entityId: result.id,
        details: `Medication saved: ${sanitized.name}`,
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Validation failed");
      await auditLogger.log("CREATE", "medication", "failure", {
        errorMessage: err.message.substring(0, 100),
      });
      throw err;
    }
  },

  async update(id: string, updates: Partial<Medication>) {
    try {
      const sanitized = {
        ...updates,
        name: updates.name ? sanitizeString(updates.name, 200) : undefined,
        dosage: updates.dosage ? sanitizeString(updates.dosage, 100) : undefined,
        frequency: updates.frequency ? sanitizeString(updates.frequency, 100) : undefined,
        pharmacyName: updates.pharmacyName ? sanitizeString(updates.pharmacyName, 200) : undefined,
        pharmacyPhone: updates.pharmacyPhone ? sanitizePhone(updates.pharmacyPhone) : undefined,
      };

      await rawMedicationStorage.update(id, sanitized);

      await auditLogger.log("UPDATE", "medication", "success", {
        entityId: id,
        details: "Medication updated",
      });
    } catch (error) {
      await auditLogger.log("UPDATE", "medication", "failure", {
        entityId: id,
        errorMessage: error instanceof Error ? error.message.substring(0, 100) : "Update failed",
      });
      throw error;
    }
  },

  async delete(id: string) {
    try {
      await rawMedicationStorage.delete(id);
      await auditLogger.log("DELETE", "medication", "success", {
        entityId: id,
        details: "Medication deleted",
      });
    } catch (error) {
      await auditLogger.log("DELETE", "medication", "failure", {
        entityId: id,
        errorMessage: error instanceof Error ? error.message.substring(0, 100) : "Delete failed",
      });
      throw error;
    }
  },

  getAll: rawMedicationStorage.getAll,
};

export const validatedDoctorStorage = {
  async save(doc: Omit<Doctor, "id" | "created_at">, entryOwner: RecordOwner = "self") {
    try {
      const sanitized = {
        ...doc,
        name: sanitizeString(doc.name, 200),
        specialty: sanitizeString(doc.specialty, 100),
        phone: sanitizePhone(doc.phone),
        address: sanitizeString(doc.address, 300),
        hospital: sanitizeString(doc.hospital, 200),
      };

      const validated = validateInput(DoctorSchema, {
        id: "temp",
        ...sanitized,
      });

      const result = await rawDoctorsStorage.save(sanitized, entryOwner);

      await auditLogger.log("CREATE", "doctor", "success", {
        entityId: result.id,
        details: `Doctor saved: ${sanitized.name}`,
      });

      return result;
    } catch (error) {
      await auditLogger.log("CREATE", "doctor", "failure", {
        errorMessage: error instanceof Error ? error.message.substring(0, 100) : "Save failed",
      });
      throw error;
    }
  },

  async update(id: string, updates: Partial<Omit<Doctor, "id" | "created_at">>) {
    try {
      const sanitized = {
        ...updates,
        name: updates.name ? sanitizeString(updates.name, 200) : undefined,
        specialty: updates.specialty ? sanitizeString(updates.specialty, 100) : undefined,
        phone: updates.phone ? sanitizePhone(updates.phone) : undefined,
        address: updates.address ? sanitizeString(updates.address, 300) : undefined,
        hospital: updates.hospital ? sanitizeString(updates.hospital, 200) : undefined,
      };

      await rawDoctorsStorage.update(id, sanitized);

      await auditLogger.log("UPDATE", "doctor", "success", {
        entityId: id,
        details: "Doctor updated",
      });
    } catch (error) {
      await auditLogger.log("UPDATE", "doctor", "failure", {
        entityId: id,
        errorMessage: error instanceof Error ? error.message.substring(0, 100) : "Update failed",
      });
      throw error;
    }
  },

  async delete(id: string) {
    try {
      await rawDoctorsStorage.delete(id);
      await auditLogger.log("DELETE", "doctor", "success", {
        entityId: id,
      });
    } catch (error) {
      await auditLogger.log("DELETE", "doctor", "failure", {
        entityId: id,
        errorMessage: error instanceof Error ? error.message.substring(0, 100) : "Delete failed",
      });
      throw error;
    }
  },

  getAll: rawDoctorsStorage.getAll,
  addOrGet: rawDoctorsStorage.addOrGet,
  setPrimary: rawDoctorsStorage.setPrimary,
  setEmergency: rawDoctorsStorage.setEmergency,
};

export const validatedAppointmentStorage = {
  async save(apt: Omit<Appointment, "id">) {
    try {
      const sanitized = {
        ...apt,
        doctorName: sanitizeString(apt.doctorName, 200),
        specialty: sanitizeString(apt.specialty, 100),
        location: sanitizeString(apt.location, 300),
        notes: sanitizeString(apt.notes, 1000),
        phoneNumber: sanitizePhone(apt.phoneNumber),
      };

      const validated = validateInput(AppointmentSchema, {
        id: "temp",
        ...sanitized,
      });

      const result = await rawAppointmentStorage.save(sanitized);

      await auditLogger.log("CREATE", "appointment", "success", {
        entityId: result.id,
        details: `Appointment saved: ${sanitized.doctorName}`,
      });

      return result;
    } catch (error) {
      await auditLogger.log("CREATE", "appointment", "failure", {
        errorMessage: error instanceof Error ? error.message.substring(0, 100) : "Save failed",
      });
      throw error;
    }
  },

  async update(id: string, updates: Partial<Appointment>) {
    try {
      const sanitized = {
        ...updates,
        doctorName: updates.doctorName ? sanitizeString(updates.doctorName, 200) : undefined,
        specialty: updates.specialty ? sanitizeString(updates.specialty, 100) : undefined,
        location: updates.location ? sanitizeString(updates.location, 300) : undefined,
        notes: updates.notes ? sanitizeString(updates.notes, 1000) : undefined,
        phoneNumber: updates.phoneNumber ? sanitizePhone(updates.phoneNumber) : undefined,
      };

      await rawAppointmentStorage.update(id, sanitized);

      await auditLogger.log("UPDATE", "appointment", "success", {
        entityId: id,
      });
    } catch (error) {
      await auditLogger.log("UPDATE", "appointment", "failure", {
        entityId: id,
        errorMessage: error instanceof Error ? error.message.substring(0, 100) : "Update failed",
      });
      throw error;
    }
  },

  async delete(id: string) {
    try {
      await rawAppointmentStorage.delete(id);
      await auditLogger.log("DELETE", "appointment", "success", {
        entityId: id,
      });
    } catch (error) {
      await auditLogger.log("DELETE", "appointment", "failure", {
        entityId: id,
        errorMessage: error instanceof Error ? error.message.substring(0, 100) : "Delete failed",
      });
      throw error;
    }
  },

  getAll: rawAppointmentStorage.getAll,
  setAll: rawAppointmentStorage.setAll,
};

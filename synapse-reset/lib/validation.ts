import { z } from "zod";

export const MedicationDoseSchema = z.object({
  id: z.string().min(1),
  amount: z.string().trim().min(1).max(100),
  unit: z.string().trim().min(1).max(50),
  timeOfDay: z.string().trim().min(1),
  reminderTime: z.string().optional(),
  optionalNotes: z.string().trim().max(500).optional(),
});

export const MedicationSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().max(100).optional(),
  unit: z.string().trim().max(50).optional(),
  frequency: z.string().trim().min(1).max(100),
  route: z.string().trim().max(100).optional(),
  doses: z.array(MedicationDoseSchema).optional(),
  active: z.boolean(),
  medicationType: z.enum(["scheduled", "prn"]).optional(),
  pharmacyName: z.string().trim().max(200).optional(),
  pharmacyPhone: z.string().trim().max(20).optional(),
  reminderCadence: z.enum(["daily", "weekly", "biweekly", "custom"]).optional(),
  currentSupplyAmount: z.number().positive().optional(),
  amountPerRefill: z.number().positive().optional(),
});

export const DoctorSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  specialty: z.string().trim().max(100).optional(),
  phone: z.string().trim().regex(/^[\d\-\+\(\)\s]*$/, "Invalid phone format").max(20).optional(),
  address: z.string().trim().max(300).optional(),
  hospital: z.string().trim().max(200).optional(),
  isPrimary: z.boolean().optional(),
  isEmergency: z.boolean().optional(),
});

export const AppointmentSchema = z.object({
  id: z.string().min(1),
  doctorName: z.string().trim().min(1).max(200),
  specialty: z.string().trim().max(100),
  date: z.string().date(),
  time: z.string().time().optional(),
  location: z.string().trim().max(300),
  notes: z.string().trim().max(1000).optional(),
  phoneNumber: z.string().trim().regex(/^[\d\-\+\(\)\s]*$/, "Invalid phone format").max(20).optional(),
  status: z.enum(["completed", "rescheduled", "cancelled"]).optional(),
});

export const HealthLogSchema = z.object({
  id: z.string().min(1),
  date: z.string().date(),
  energy: z.number().int().min(0).max(10),
  mood: z.number().int().min(0).max(10),
  sleep: z.number().int().min(0).max(24),
  notes: z.string().trim().max(1000).optional(),
  fasting: z.boolean().optional(),
});

export const VitalSchema = z.object({
  id: z.string().min(1),
  date: z.string().date(),
  type: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(100),
  unit: z.string().trim().min(1).max(50),
  bloodPressureSystolic: z.number().positive().optional(),
  bloodPressureDiastolic: z.number().positive().optional(),
  heartRate: z.number().positive().optional(),
  bodyTemperature: z.number().positive().optional(),
  oxygenSaturation: z.number().min(0).max(100).optional(),
});

export const SymptomSchema = z.object({
  id: z.string().min(1),
  date: z.string().date(),
  name: z.string().trim().min(1).max(200),
  severity: z.number().int().min(0).max(10),
  notes: z.string().trim().max(1000).optional(),
  trigger: z.string().trim().max(200).optional(),
});

export const AuthRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const AuthResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
  }),
});

export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.string().optional(),
});

export const AnalyzeDocumentRequestSchema = z.object({
  imageBase64: z.string().min(100),
  mimeType: z.string().regex(/^image\/(jpeg|png|jpg|webp)$/),
});

export const AnalyzeDocumentResponseSchema = z.object({
  diagnoses: z.array(z.string()).optional(),
  medications: z.array(
    z.object({
      name: z.string(),
      dosage: z.string(),
      frequency: z.string(),
      status: z.string().optional(),
    })
  ).optional(),
  labResults: z.array(
    z.object({
      test: z.string(),
      value: z.string(),
      unit: z.string(),
      referenceRange: z.string().optional(),
      flag: z.string().optional(),
    })
  ).optional(),
  followUpDates: z.array(
    z.object({
      date: z.string(),
      doctor: z.string(),
      purpose: z.string(),
    })
  ).optional(),
  summary: z.string().optional(),
});

export const HealthInsightResponseSchema = z.object({
  changes: z.array(z.object({
    title: z.string(),
    description: z.string(),
    type: z.string().optional(),
  })).optional(),
  unclear: z.array(z.object({
    title: z.string(),
    description: z.string(),
    suggestion: z.string().optional(),
  })).optional(),
  labsToTrack: z.array(z.object({
    test: z.string(),
    reason: z.string().optional(),
    frequency: z.string().optional(),
  })).optional(),
  symptomCorrelations: z.array(z.object({
    pattern: z.string(),
    description: z.string().optional(),
    confidence: z.string().optional(),
  })).optional(),
  medicationNotes: z.array(z.object({
    medication: z.string(),
    note: z.string(),
    type: z.string().optional(),
  })).optional(),
  ramadanTips: z.array(z.object({
    tip: z.string(),
    category: z.string().optional(),
  })).optional(),
  summary: z.string().optional(),
});

export type Medication = z.infer<typeof MedicationSchema>;
export type Doctor = z.infer<typeof DoctorSchema>;
export type Appointment = z.infer<typeof AppointmentSchema>;
export type HealthLog = z.infer<typeof HealthLogSchema>;
export type Vital = z.infer<typeof VitalSchema>;
export type Symptom = z.infer<typeof SymptomSchema>;
export type AuthRequest = z.infer<typeof AuthRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      throw new Error(`Validation failed: ${messages}`);
    }
    throw error;
  }
}

export function validateInputSafe<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
  try {
    return schema.parse(data);
  } catch (error) {
    console.warn("Validation error - data rejected silently");
    return null;
  }
}

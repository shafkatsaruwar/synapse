/**
 * Self-pinned storage. Background work (notifications, widgets, backups, enforcement) and
 * screens about the device owner import from here so they never follow the care profile
 * currently being viewed. Everything else is re-exported unchanged.
 */
import { selfStores } from "@/lib/storage";

export * from "@/lib/storage";

export const healthLogStorage = selfStores.healthLogStorage;
export const symptomStorage = selfStores.symptomStorage;
export const feedbackStorage = selfStores.feedbackStorage;
export const medicationStorage = selfStores.medicationStorage;
export const medicationLogStorage = selfStores.medicationLogStorage;
export const medicationEnforcementStorage = selfStores.medicationEnforcementStorage;
export const doctorsStorage = selfStores.doctorsStorage;
export const pharmacyStorage = selfStores.pharmacyStorage;
export const appointmentStorage = selfStores.appointmentStorage;
export const doctorNoteStorage = selfStores.doctorNoteStorage;
export const labWorkStorage = selfStores.labWorkStorage;
export const imagingStorage = selfStores.imagingStorage;
export const fastingLogStorage = selfStores.fastingLogStorage;
export const vitalStorage = selfStores.vitalStorage;
export const settingsStorage = selfStores.settingsStorage;
export const roleStorage = selfStores.roleStorage;
export const caregiverProfileStorage = selfStores.caregiverProfileStorage;
export const sickModeStorage = selfStores.sickModeStorage;
export const documentStorage = selfStores.documentStorage;
export const insightStorage = selfStores.insightStorage;
export const medComparisonStorage = selfStores.medComparisonStorage;
export const allergyStorage = selfStores.allergyStorage;
export const emergencyDoctorStorage = selfStores.emergencyDoctorStorage;
export const primaryDoctorStorage = selfStores.primaryDoctorStorage;
export const healthProfileStorage = selfStores.healthProfileStorage;
export const cycleTrackingStorage = selfStores.cycleTrackingStorage;
export const conditionStorage = selfStores.conditionStorage;
export const monthlyCheckInStorage = selfStores.monthlyCheckInStorage;
export const eatingStorage = selfStores.eatingStorage;
export const hydrationStorage = selfStores.hydrationStorage;
export const mentalHealthModeStorage = selfStores.mentalHealthModeStorage;
export const comfortStorage = selfStores.comfortStorage;
export const goalStorage = selfStores.goalStorage;

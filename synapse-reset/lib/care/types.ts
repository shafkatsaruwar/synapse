import type { ContactWindow, QuietHours } from "./checkin-schedule";

export const CARE_SCHEMA_VERSION = 1;

export type CareProfileType = "self" | "caregiver_managed" | "connected_reference";

/** Caregiver status is never "verified" offline; the person can only declare it. */
export type GuardianClaim = "none" | "self_declared";

export type LocalCareProfile = {
  id: string;
  schemaVersion: number;
  type: CareProfileType;
  displayName: string;
  /** YYYY-MM-DD. Preferred over a stored age. */
  dateOfBirth?: string;
  /** Age typed into older versions or when no birth date is known. */
  legacyAge?: number;
  relationship?: string;
  guardianClaim: GuardianClaim;
  /** IANA zone where the person lives. */
  timeZone: string;
  /** IANA zone their medication times are written in (defaults to timeZone). */
  medScheduleTimeZone: string;
  /** Their preferred contact window, in their own time zone. Set by the user, never inferred. */
  contactHours: ContactWindow;
  /** Optional temporary zone while they travel. */
  travelTimeZone?: string | null;
  /** Set for connected_reference profiles. */
  connectionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProfileRegistry = {
  schemaVersion: number;
  profiles: LocalCareProfile[];
  activeProfileId: string;
  /** True once the old single-caregiver data has been copied into a profile. */
  legacyCaregiverMigrated: boolean;
};

/** Responsibilities a person can hold at the same time. "Managing my own health" is always on. */
export type CareRoleFlags = {
  caregiver: boolean;
  backup: boolean;
};

export type SharingCategory =
  | "med_schedule"
  | "upcoming_appointments"
  | "med_confirmations"
  | "selected_records"
  | "emergency_info";

export const SHARING_CATEGORIES: { id: SharingCategory; label: string; blurb: string }[] = [
  { id: "med_schedule", label: "Medication schedule", blurb: "Names, doses, and times of day" },
  { id: "upcoming_appointments", label: "Upcoming appointments", blurb: "Date, time, doctor, and place" },
  { id: "med_confirmations", label: "Medication confirmations", blurb: "Which doses were marked taken, last 7 days" },
  { id: "selected_records", label: "Selected health records", blurb: "Allergies and conditions you choose" },
  { id: "emergency_info", label: "Emergency information", blurb: "Allergies and emergency notes" },
];

export type SharingPermission = {
  category: SharingCategory;
  /** View-only. Editing someone else's records is not part of this release. */
  access: "view";
};

export type ConnectionState =
  | "invitation_created"
  | "awaiting_confirmation"
  | "connected_locally"
  | "needs_verification"
  | "revoked"
  | "removed";

export type ConnectionRole = "i_care_for_them" | "they_care_for_me" | "peers";

export type CareConnection = {
  id: string;
  schemaVersion: number;
  peerName: string;
  /** What this connection is, from my point of view. */
  role: ConnectionRole;
  state: ConnectionState;
  /** Invitation id this connection grew out of. */
  inviteId: string;
  /** The signed invitation, kept only while it is waiting for a reply so its QR can be shown again. */
  invitationJson?: string;
  /** Present once the other side has answered. Base64url. */
  peerSignPublic?: string;
  peerAgreePublic?: string;
  peerTimeZone?: string;
  /** What I allow myself to export to them. Empty by default. */
  grants: SharingPermission[];
  /** What they asked me to share when they invited me (informational). */
  theyRequested: SharingCategory[];
  /** Local profile that holds the reference copy of their shared info, if any. */
  referenceProfileId?: string;
  /** Local profile this connection is about (e.g. the person I care for), if any. */
  profileId?: string;
  guardianClaim: GuardianClaim;
  verifiedAt?: string;
  lastImportAt?: string;
  lastExportAt?: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
};

export type SharedProvenance = {
  source: "shared_copy";
  fromConnectionId: string;
  fromName: string;
  eventAt: string;
  exportedAt: string;
  importedAt: string;
};

export type SharedMedication = { key: string; name: string; dose?: string; times: string[]; weekdays?: number[] };
export type SharedAppointment = { key: string; date: string; time?: string; doctorName?: string; location?: string };
export type SharedConfirmation = { key: string; medicationName: string; date: string; doseIndex: number; taken: boolean; recordedAt?: string; enteredBy?: "self" | "caregiver" };
export type SharedRecordItem = { key: string; kind: "allergy" | "condition"; label: string };
export type SharedEmergency = { allergies?: string; notes?: string };

/** The decrypted body of a SharedDataPackage. Only categories the sender granted appear. */
export type SharedPayload = {
  schema: 1;
  senderName: string;
  senderTimeZone: string;
  med_schedule?: SharedMedication[];
  upcoming_appointments?: SharedAppointment[];
  med_confirmations?: SharedConfirmation[];
  selected_records?: SharedRecordItem[];
  emergency_info?: SharedEmergency;
};

export type StoredSharedData = {
  schemaVersion: number;
  connectionId: string;
  fromName: string;
  timeZone: string;
  /** Per category: items plus the provenance of the package they came from. */
  med_schedule: { items: SharedMedication[]; provenance: SharedProvenance } | null;
  upcoming_appointments: { items: SharedAppointment[]; provenance: SharedProvenance } | null;
  med_confirmations: { items: SharedConfirmation[]; provenance: SharedProvenance } | null;
  selected_records: { items: SharedRecordItem[]; provenance: SharedProvenance } | null;
  emergency_info: { items: SharedEmergency; provenance: SharedProvenance } | null;
};

// ---------- Check-In ----------

/** The caregiver's own device-level Check-In settings. */
export type CheckInSettings = {
  /** Use whatever time zone this phone is in right now (travel-friendly). */
  followDeviceTimeZone: boolean;
  /** Used when followDeviceTimeZone is off. IANA identifier. */
  homeTimeZone: string;
  quietHours: QuietHours;
  /** Delay used for new people. */
  defaultDelayMinutes: number;
};

/** Per-person reminder choices. A person's own contact hours live on their profile. */
export type PersonCheckInPrefs = {
  personId: string;
  /** Minutes after a scheduled dose time. A check-in delay, not proof of anything. */
  delayMinutes: number;
  remindersEnabled: boolean;
  /** Days of week reminders may fire (0-6); empty means every day. */
  weekdays: number[];
};

export type CheckInContact = {
  id: string;
  name: string;
  phone?: string;
  /** IANA zone where they live. */
  timeZone: string;
  relationship?: string;
  contactHours: ContactWindow;
};

export type CheckInEventType =
  | "reminder_scheduled"
  | "reminder_opened"
  | "reminder_dismissed"
  | "reminder_rescheduled"
  | "message_prepared"
  | "marked_complete"
  | "wellness_update";

export type CheckInEvent = {
  id: string;
  profileId: string;
  type: CheckInEventType;
  at: string;
  /** Short, optional label (e.g. "Morning"). Message bodies are not retained. */
  label?: string;
  channel?: "messages" | "call" | "share";
};

export type CheckInReminderRecord = {
  id: string;
  profileId: string;
  notificationId: string;
  doseLabel: string;
  scheduleInstant: number;
  fireInstant: number;
  postponedFrom?: number;
  createdAt: string;
};

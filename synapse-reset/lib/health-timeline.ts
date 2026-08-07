import {
  type Appointment,
  type Doctor,
  type Imaging,
  type LabWork,
  type Medication,
  type MedicationLog,
  type Symptom,
} from "@/lib/storage";
import { getLocalDateKeyFromIso, getLocalTimeHHMMFromIso } from "@/lib/date-utils";

export type TimelineEventType = "appointment" | "med" | "symptom" | "lab" | "imaging";

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  title: string;
  date: string;
  time?: string;
  subtitle?: string;
  relatedDoctorId?: string;
  relatedAppointmentId?: string;
  relatedMedicationId?: string;
  contextBlocks: string[];
  metadata: Record<string, unknown>;
  /** Absolute ms for sorting — prefer recordedAt when available. */
  sortAt: number;
};

export type TimelineFilter = "all" | "appointment" | "med" | "lab" | "imaging";

type TimelineInput = {
  appointments: Appointment[];
  medications: Medication[];
  medicationLogs: MedicationLog[];
  labWork: LabWork[];
  imaging: Imaging[];
  symptoms: Symptom[];
  doctors: Doctor[];
};

function doctorName(doctors: Doctor[], id?: string) {
  return id ? doctors.find((doctor) => doctor.id === id)?.name : undefined;
}

function appointmentLabel(appointments: Appointment[], id?: string) {
  const appointment = id ? appointments.find((item) => item.id === id) : undefined;
  if (!appointment) return undefined;
  return `${appointment.doctorName}${appointment.date ? ` on ${appointment.date}` : ""}`;
}

/** Parse local calendar date + optional HH:MM as local wall time. */
function localDateTimeMs(date: string, time?: string) {
  const hhmm = (time?.trim() || "12:00").slice(0, 5);
  const normalized = hhmm.length === 5 ? `${hhmm}:00` : hhmm;
  const parsed = new Date(`${date}T${normalized}`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function sortAtFromIsoOrDate(iso: string | undefined, date: string, time?: string) {
  if (iso) {
    const ms = new Date(iso).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  return localDateTimeMs(date, time);
}

export function buildHealthTimeline(input: TimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  input.appointments.forEach((appointment) => {
    const contextBlocks = [
      appointment.doctor_id ? `Appointment with ${appointment.doctorName}` : "",
      appointment.location ? `Location: ${appointment.location}` : "",
      appointment.status ? `Status: ${appointment.status}` : "",
    ].filter(Boolean);

    events.push({
      id: `appointment-${appointment.id}`,
      type: "appointment",
      title: appointment.doctorName || "Appointment",
      subtitle: appointment.specialty || appointment.location || "Appointment",
      date: appointment.date,
      time: appointment.time,
      relatedDoctorId: appointment.doctor_id,
      relatedAppointmentId: appointment.id,
      contextBlocks: [
        ...contextBlocks,
        appointment.source === "scan" ? "Source: scan" : "",
      ].filter(Boolean),
      metadata: { ...appointment, source: appointment.source } as unknown as Record<string, unknown>,
      sortAt: localDateTimeMs(appointment.date, appointment.time),
    });
  });

  input.medicationLogs
    .filter((log) => log.taken)
    .forEach((log) => {
      const medication = input.medications.find((item) => item.id === log.medicationId);
      if (!medication) return;
      const prescriber = doctorName(input.doctors, medication.doctorId);
      const dose = medication.doses?.[log.doseIndex ?? 0];
      const doseText = dose?.amount && dose?.unit ? `${dose.amount} ${dose.unit}` : medication.dosage || medication.frequency;

      // Prefer local wall-clock from recordedAt — never slice ISO "T21:15:00.000Z" (that is UTC).
      const localTime = getLocalTimeHHMMFromIso(log.recordedAt) || log.scheduledTime;
      const localDate = log.recordedAt ? getLocalDateKeyFromIso(log.recordedAt) : log.date;

      events.push({
        id: `med-${log.id}`,
        type: "med",
        title: medication.name || "Medication",
        subtitle: doseText || "Medication logged",
        date: localDate,
        time: localTime,
        relatedDoctorId: medication.doctorId,
        relatedMedicationId: medication.id,
        contextBlocks: [
          prescriber ? `Prescribed by ${prescriber}` : "",
          medication.source === "scan" ? "Source: scan" : "",
          log.reason ? `Reason: ${log.reason}` : "",
          log.notes ? `Note: ${log.notes}` : "",
        ].filter(Boolean),
        metadata: { medication, log },
        sortAt: sortAtFromIsoOrDate(log.recordedAt, localDate, localTime),
      });
    });

  input.labWork.forEach((lab) => {
    const doctor = doctorName(input.doctors, lab.doctorId);
    const orderedDuring = appointmentLabel(input.appointments, lab.appointmentId);
    events.push({
      id: `lab-${lab.id}`,
      type: "lab",
      title: lab.testName,
      subtitle: [doctor, lab.status].filter(Boolean).join(" · ") || "Lab work",
      date: lab.date,
      relatedDoctorId: lab.doctorId,
      relatedAppointmentId: lab.appointmentId,
      contextBlocks: [
        doctor ? `Ordered by ${doctor}` : "",
        orderedDuring ? `Ordered during appointment: ${orderedDuring}` : "",
        lab.status === "pending" ? "Follow-up required" : "",
        lab.source === "scan" ? "Source: scan" : "",
      ].filter(Boolean),
      metadata: lab as unknown as Record<string, unknown>,
      sortAt: localDateTimeMs(lab.date),
    });
  });

  input.imaging.forEach((scan) => {
    const doctor = doctorName(input.doctors, scan.doctorId);
    const appointment = appointmentLabel(input.appointments, scan.appointmentId);
    events.push({
      id: `imaging-${scan.id}`,
      type: "imaging",
      title: scan.type,
      subtitle: [scan.bodyArea, doctor].filter(Boolean).join(" · ") || "Imaging",
      date: scan.date,
      relatedDoctorId: scan.doctorId,
      relatedAppointmentId: scan.appointmentId,
      contextBlocks: [
        doctor ? `Ordered by ${doctor}` : "",
        appointment ? `Connected to appointment: ${appointment}` : "",
        scan.source === "scan" ? "Source: scan" : "",
      ].filter(Boolean),
      metadata: scan as unknown as Record<string, unknown>,
      sortAt: localDateTimeMs(scan.date),
    });
  });

  input.symptoms.forEach((symptom) => {
    const localTime = getLocalTimeHHMMFromIso(symptom.recordedAt);
    const localDate = symptom.recordedAt ? getLocalDateKeyFromIso(symptom.recordedAt) : symptom.date;
    events.push({
      id: `symptom-${symptom.id}`,
      type: "symptom",
      title: symptom.name || "Symptom",
      subtitle: `Severity ${symptom.severity}/10`,
      date: localDate,
      time: localTime,
      contextBlocks: [
        symptom.trigger ? `Trigger: ${symptom.trigger}` : "",
        symptom.durationMinutes ? `Duration: ${symptom.durationMinutes} min` : "",
        symptom.notes ? `Note: ${symptom.notes}` : "",
      ].filter(Boolean),
      metadata: symptom as unknown as Record<string, unknown>,
      sortAt: sortAtFromIsoOrDate(symptom.recordedAt, localDate, localTime),
    });
  });

  // Most recent first so “just logged” appears at the top (times are local wall-clock).
  return events.sort((a, b) => b.sortAt - a.sortAt || a.title.localeCompare(b.title));
}

export function groupTimelineByDay(events: TimelineEvent[]) {
  // Preserve event order. With newest-first events, day groups appear newest → older.
  return events.reduce<{ date: string; events: TimelineEvent[] }[]>((groups, event) => {
    const group = groups.find((item) => item.date === event.date);
    if (group) {
      group.events.push(event);
    } else {
      groups.push({ date: event.date, events: [event] });
    }
    return groups;
  }, []);
}

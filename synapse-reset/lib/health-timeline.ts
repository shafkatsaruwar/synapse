import {
  type Appointment,
  type Doctor,
  type Imaging,
  type LabWork,
  type Medication,
  type MedicationLog,
  type Symptom,
} from "@/lib/storage";

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

function toTimestamp(event: TimelineEvent) {
  const time = event.time?.trim() || "12:00";
  const parsed = new Date(`${event.date}T${time.length === 5 ? `${time}:00` : time}`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
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

      events.push({
        id: `med-${log.id}`,
        type: "med",
        title: medication.name || "Medication",
        subtitle: doseText || "Medication logged",
        date: log.date,
        time: log.recordedAt?.slice(11, 16) || log.scheduledTime,
        relatedDoctorId: medication.doctorId,
        relatedMedicationId: medication.id,
        contextBlocks: [
          prescriber ? `Prescribed by ${prescriber}` : "",
          medication.source === "scan" ? "Source: scan" : "",
          log.reason ? `Reason: ${log.reason}` : "",
          log.notes ? `Note: ${log.notes}` : "",
        ].filter(Boolean),
        metadata: { medication, log },
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
    });
  });

  input.symptoms.forEach((symptom) => {
    events.push({
      id: `symptom-${symptom.id}`,
      type: "symptom",
      title: symptom.name || "Symptom",
      subtitle: `Severity ${symptom.severity}/10`,
      date: symptom.date,
      time: symptom.recordedAt?.slice(11, 16),
      contextBlocks: [
        symptom.trigger ? `Trigger: ${symptom.trigger}` : "",
        symptom.durationMinutes ? `Duration: ${symptom.durationMinutes} min` : "",
        symptom.notes ? `Note: ${symptom.notes}` : "",
      ].filter(Boolean),
      metadata: symptom as unknown as Record<string, unknown>,
    });
  });

  return events.sort((a, b) => toTimestamp(b) - toTimestamp(a));
}

export function groupTimelineByDay(events: TimelineEvent[]) {
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

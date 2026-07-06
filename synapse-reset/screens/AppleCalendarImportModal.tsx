import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { appointmentStorage, doctorsStorage, healthProfileStorage, type Doctor, type HealthProfileInfo, type RecordOwner } from "@/lib/storage";
import {
  appleEventDateParts,
  getUpcomingAppleCalendarEvents,
  isAppleCalendarImportSupported,
  requestAppleCalendarAccess,
  type AppleCalendarEvent,
} from "@/lib/apple-calendar-import";
import { formatDate, formatTime12h } from "@/lib/date-utils";
import { syncWidgetSnapshot } from "@/lib/widget-sync";

type Draft = {
  doctorId: string | null;
  doctorName: string;
  title: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  phone: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onImported: (appointmentDate?: string) => void;
};

const INITIAL_LOOKAHEAD_DAYS = 30;
const MAX_LOOKAHEAD_DAYS = 90;
const MEDICAL_TITLE_KEYWORDS = ["dr", "doctor", "md", "clinic", "hospital", "appointment"];
const MEDICAL_LOCATION_KEYWORDS = [
  "clinic",
  "hospital",
  "medical",
  "health",
  "healthcare",
  "urgent care",
  "office",
  "center",
  "centre",
  "practice",
  "pharmacy",
  "dental",
  "dentist",
  "therapy",
  "lab",
  "radiology",
  "imaging",
];

export default function AppleCalendarImportModal({ visible, onClose, onImported }: Props) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [calendarUnsupported, setCalendarUnsupported] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [lookaheadDays, setLookaheadDays] = useState(INITIAL_LOOKAHEAD_DAYS);
  const [allEventsExpanded, setAllEventsExpanded] = useState(false);
  const [events, setEvents] = useState<AppleCalendarEvent[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [profile, setProfile] = useState<HealthProfileInfo>({ userRole: "self" });
  const [entryOwner, setEntryOwner] = useState<RecordOwner>("self");
  const [selectedEvent, setSelectedEvent] = useState<AppleCalendarEvent | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const isCaregiver = profile.userRole === "caregiver" && !!profile.caredForName?.trim();
  const ownerOptions: { value: RecordOwner; label: string }[] = [
    { value: "self", label: "You" },
    ...(isCaregiver ? [{ value: "care_recipient" as const, label: profile.caredForName!.trim() }] : []),
  ];
  const scopedDoctors = useMemo(
    () => doctors.filter((doctor) => (doctor.entryOwner ?? "self") === entryOwner),
    [doctors, entryOwner]
  );
  const suggestedEvents = useMemo(() => events.filter(isSuggestedAppointment), [events]);
  const remainingEvents = useMemo(() => events.filter((event) => !isSuggestedAppointment(event)), [events]);

  useEffect(() => {
    if (!visible) return;
    setSelectedEvent(null);
    setDraft(emptyDraft());
    setPermissionDenied(false);
    setCalendarUnsupported(false);
    setCalendarError("");
    setLookaheadDays(INITIAL_LOOKAHEAD_DAYS);
    setAllEventsExpanded(false);
    setEvents([]);
    void loadDoctorContext();
    void loadEvents(INITIAL_LOOKAHEAD_DAYS);
  }, [visible]);

  useEffect(() => {
    if (!selectedEvent) return;
    setDraft(createDraftFromEvent(selectedEvent, scopedDoctors));
  }, [entryOwner, scopedDoctors, selectedEvent]);

  const loadDoctorContext = async () => {
    const [profileInfo, doctorList] = await Promise.all([
      healthProfileStorage.get(),
      doctorsStorage.getAll(),
    ]);
    setProfile(profileInfo);
    const defaultOwner: RecordOwner = profileInfo.userRole === "caregiver" && profileInfo.caredForName?.trim() ? "care_recipient" : "self";
    setEntryOwner(defaultOwner);
    setDoctors(doctorList);
  };

  const loadEvents = async (daysAhead = lookaheadDays) => {
    if (Platform.OS !== "ios") {
      setCalendarUnsupported(true);
      setPermissionDenied(false);
      setCalendarError("Apple Calendar import only works on iOS.");
      return;
    }

    setLoading(true);
    setCalendarError("");
    try {
      if (!isAppleCalendarImportSupported()) {
        setCalendarUnsupported(true);
        setPermissionDenied(false);
        setCalendarError("The installed app binary is missing SynapseCalendarBridge.");
        return;
      }
      setCalendarUnsupported(false);
      const granted = await requestAppleCalendarAccess();
      if (!granted) {
        setPermissionDenied(true);
        setCalendarError("iOS did not grant full Calendar access to Synapse.");
        return;
      }
      const upcoming = await getUpcomingAppleCalendarEvents(daysAhead);
      setEvents(upcoming);
      setLookaheadDays(daysAhead);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPermissionDenied(true);
      setCalendarError(message || "Synapse could not read Apple Calendar events.");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreEvents = () => {
    const nextLookaheadDays = Math.min(lookaheadDays + INITIAL_LOOKAHEAD_DAYS, MAX_LOOKAHEAD_DAYS);
    if (nextLookaheadDays !== lookaheadDays) {
      void loadEvents(nextLookaheadDays);
    }
  };

  const selectEvent = (event: AppleCalendarEvent) => {
    setSelectedEvent(event);
    setDraft(createDraftFromEvent(event, scopedDoctors));
  };

  const saveAppointment = async () => {
    if (!draft.doctorName.trim() || !draft.date.trim()) {
      Alert.alert("Missing info", "Add a doctor and date before importing.");
      return;
    }

    const matchedDoctor = draft.doctorId ? scopedDoctors.find((doctor) => doctor.id === draft.doctorId) ?? null : null;
    const doctor = matchedDoctor ?? await doctorsStorage.addOrGet({
      name: draft.doctorName.trim(),
      phone: draft.phone.trim() || undefined,
      hospital: draft.location.trim() || undefined,
      entryOwner,
    }, entryOwner);
    setDoctors((prev) => [...prev.filter((item) => item.id !== doctor.id), doctor].sort((a, b) => a.name.localeCompare(b.name)));

    await appointmentStorage.save({
      doctorName: doctor.name,
      doctor_id: doctor.id,
      specialty: draft.title.trim(),
      date: draft.date.trim(),
      time: draft.time.trim() || "09:00",
      location: draft.location.trim(),
      notes: buildImportedNotes(draft),
      entryOwner,
    });
    await syncWidgetSnapshot().catch(() => {});
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onImported(draft.date.trim());
  };

  const openCalendarSettings = async () => {
    await Linking.openSettings().catch(() => {
      Alert.alert("Open Settings", "Open iOS Settings, choose Synapse, and allow Calendar access.");
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={selectedEvent ? () => setSelectedEvent(null) : onClose} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={selectedEvent ? "Back to events" : "Close"}>
            <Ionicons name={selectedEvent ? "chevron-back" : "close"} size={24} color={C.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Calendar Import</Text>
            <Text style={styles.title}>{selectedEvent ? "Import Preview" : "Apple Calendar"}</Text>
          </View>
        </View>

        {selectedEvent ? (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled">
            {ownerOptions.length > 1 ? (
              <View style={styles.ownerRow}>
                {ownerOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[styles.ownerChip, entryOwner === option.value && styles.ownerChipActive]}
                    onPress={() => {
                      setEntryOwner(option.value);
                      Haptics.selectionAsync();
                    }}
                  >
                    <Text style={[styles.ownerChipText, entryOwner === option.value && styles.ownerChipTextActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Doctor</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.doctorChips}>
                {scopedDoctors.map((doctor) => (
                  <Pressable
                    key={doctor.id}
                    style={[styles.doctorChip, draft.doctorId === doctor.id && styles.doctorChipActive]}
                    onPress={() => setDraft((prev) => ({ ...prev, doctorId: doctor.id, doctorName: doctor.name }))}
                  >
                    <Text style={[styles.doctorChipText, draft.doctorId === doctor.id && styles.doctorChipTextActive]}>{doctor.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput
                value={draft.doctorName}
                onChangeText={(doctorName) => setDraft((prev) => ({ ...prev, doctorId: null, doctorName }))}
                style={styles.input}
                placeholder="Doctor name"
                placeholderTextColor="#8B8B93"
              />
              <Text style={styles.smartHint}>
                {draft.doctorId ? "Matched an existing doctor." : draft.doctorName.trim() ? "Will create this doctor if needed." : "No doctor detected. Add one manually."}
              </Text>
            </View>

            <Field label="Title" value={draft.title} onChangeText={(title) => setDraft((prev) => ({ ...prev, title }))} styles={styles} />
            <View style={styles.row}>
              <Field label="Date" value={draft.date} onChangeText={(date) => setDraft((prev) => ({ ...prev, date }))} styles={styles} />
              <Field label="Time" value={draft.time} onChangeText={(time) => setDraft((prev) => ({ ...prev, time }))} styles={styles} />
            </View>
            <Field label="Location" value={draft.location} onChangeText={(location) => setDraft((prev) => ({ ...prev, location }))} styles={styles} />
            <Field label="Phone" value={draft.phone} onChangeText={(phone) => setDraft((prev) => ({ ...prev, phone }))} styles={styles} />
            <Field label="Notes" value={draft.notes} onChangeText={(notes) => setDraft((prev) => ({ ...prev, notes }))} multiline styles={styles} />
            <Pressable onPress={saveAppointment} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
              <Ionicons name="calendar" size={19} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Confirm Import</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
            {loading ? (
              <View style={styles.centerState}>
                <ActivityIndicator color={C.tint} />
                <Text style={styles.stateTitle}>Checking Apple Calendar</Text>
              </View>
            ) : calendarUnsupported ? (
              <View style={styles.centerState}>
                <Ionicons name="calendar-outline" size={40} color={C.textTertiary} />
                <Text style={styles.stateTitle}>Calendar import unavailable</Text>
                <Text style={styles.stateText}>This installed build does not include Calendar import support yet. Install the latest Synapse build, then open this again.</Text>
                {!!calendarError && <Text style={styles.stateFootnote}>{calendarError}</Text>}
                <Pressable onPress={onClose} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Close</Text>
                </Pressable>
              </View>
            ) : permissionDenied ? (
              <View style={styles.centerState}>
                <Ionicons name="calendar-outline" size={40} color={C.textTertiary} />
                <Text style={styles.stateTitle}>Calendar access needed</Text>
                <Text style={styles.stateText}>Allow Synapse to read Apple Calendar events, then pick the appointment you want to import.</Text>
                {!!calendarError && <Text style={styles.stateFootnote}>{calendarError}</Text>}
                <Text style={styles.stateFootnote}>If Calendar is missing from Synapse settings, install the latest build first. iOS only shows Calendar here after the app includes the native permission support.</Text>
                <View style={styles.stateActions}>
                  <Pressable onPress={openCalendarSettings} style={styles.primarySettingsButton}>
                    <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.primarySettingsButtonText}>Open Settings</Text>
                  </Pressable>
                  <Pressable onPress={() => loadEvents()} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Try Again</Text>
                  </Pressable>
                </View>
              </View>
            ) : events.length === 0 ? (
              <View style={styles.centerState}>
                <Ionicons name="calendar-clear-outline" size={40} color={C.textTertiary} />
                <Text style={styles.stateTitle}>No upcoming events found</Text>
                <Text style={styles.stateText}>Synapse checked the next {lookaheadDays} days for timed Apple Calendar events.</Text>
                {lookaheadDays < MAX_LOOKAHEAD_DAYS && (
                  <Pressable onPress={loadMoreEvents} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Look Further Ahead</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                <Text style={styles.helperText}>Synapse checks the next {lookaheadDays} days and puts likely medical visits first.</Text>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Suggested Appointments</Text>
                    <Text style={styles.sectionCount}>{suggestedEvents.length}</Text>
                  </View>
                  {suggestedEvents.length > 0 ? (
                    suggestedEvents.map((event) => <EventCard key={event.id} event={event} onPress={() => selectEvent(event)} styles={styles} colors={C} />)
                  ) : (
                    <View style={styles.emptySection}>
                      <Text style={styles.emptySectionText}>No obvious appointments found yet.</Text>
                    </View>
                  )}
                </View>

                <View style={styles.section}>
                  <Pressable onPress={() => setAllEventsExpanded((prev) => !prev)} style={styles.collapsedHeader} accessibilityRole="button" accessibilityLabel={allEventsExpanded ? "Hide all calendar events" : "Show all calendar events"}>
                    <View>
                      <Text style={styles.sectionTitle}>All Events</Text>
                      <Text style={styles.collapsedHint}>{remainingEvents.length} other event{remainingEvents.length === 1 ? "" : "s"}</Text>
                    </View>
                    <Ionicons name={allEventsExpanded ? "chevron-up" : "chevron-down"} size={20} color={C.textSecondary} />
                  </Pressable>

                  {allEventsExpanded && (
                    remainingEvents.length > 0 ? (
                      remainingEvents.map((event) => <EventCard key={event.id} event={event} onPress={() => selectEvent(event)} styles={styles} colors={C} />)
                    ) : (
                      <View style={styles.emptySection}>
                        <Text style={styles.emptySectionText}>No extra timed events in this range.</Text>
                      </View>
                    )
                  )}
                </View>

                {lookaheadDays < MAX_LOOKAHEAD_DAYS && (
                  <Pressable onPress={loadMoreEvents} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Load Next 30 Days</Text>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function EventCard({
  event,
  onPress,
  styles,
  colors: C,
}: {
  event: AppleCalendarEvent;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Theme;
}) {
  const parts = appleEventDateParts(event);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.eventCard, pressed && styles.buttonPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Import ${event.title}`}
    >
      <View style={styles.dateBadge}>
        <Text style={styles.dateDay}>{new Date(`${parts.date}T12:00:00`).getDate()}</Text>
        <Text style={styles.dateMonth}>{new Date(`${parts.date}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}</Text>
      </View>
      <View style={styles.eventText}>
        <Text style={styles.eventTitle} numberOfLines={1}>{event.title || "Appointment"}</Text>
        <Text style={styles.eventMeta} numberOfLines={1}>{formatDate(parts.date)} • {formatTime12h(parts.time)}</Text>
        {!!event.location && <Text style={styles.eventLocation} numberOfLines={1}>{event.location}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
    </Pressable>
  );
}

function isSuggestedAppointment(event: AppleCalendarEvent) {
  const title = normalizeCalendarText(event.title);
  const location = normalizeCalendarText(event.location);

  return MEDICAL_TITLE_KEYWORDS.some((keyword) => title.includes(keyword)) ||
    MEDICAL_LOCATION_KEYWORDS.some((keyword) => location.includes(keyword));
}

function normalizeCalendarText(value: string) {
  return value.toLowerCase().replace(/\./g, "");
}

function createDraftFromEvent(event: AppleCalendarEvent, doctors: Doctor[]): Draft {
  const parts = appleEventDateParts(event);
  const parsed = parseCalendarEvent(event);
  const doctorMatch = parsed.doctorName ? findDoctorMatch(parsed.doctorName, doctors) : null;

  return {
    doctorId: doctorMatch?.id ?? null,
    doctorName: doctorMatch?.name ?? parsed.doctorName,
    title: parsed.title || event.title?.trim() || "Appointment",
    date: parts.date,
    time: parts.time,
    location: parsed.location,
    notes: parsed.notes,
    phone: parsed.phone,
  };
}

function parseCalendarEvent(event: AppleCalendarEvent) {
  const rawTitle = event.title?.trim() || "";
  const rawNotes = event.notes?.trim() || "";
  const rawLocation = event.location?.trim() || "";
  const combined = [rawTitle, rawNotes].filter(Boolean).join("\n");
  const doctorName = extractDoctorName(combined);
  const phone = extractPhone(combined);
  const title = cleanupAppointmentTitle(rawTitle, doctorName);
  const notes = cleanupNotes(rawNotes, phone);

  return {
    doctorName,
    title,
    location: rawLocation,
    notes,
    phone,
  };
}

function extractDoctorName(value: string) {
  const patterns = [
    /\bwith\s+dr\.?\s+([a-z][a-z.'-]+(?:\s+[a-z][a-z.'-]+){0,3})(?:,?\s*(?:m\.?d\.?|md|do|d\.?o\.?))?\b/i,
    /\bdr\.?\s+([a-z][a-z.'-]+(?:\s+[a-z][a-z.'-]+){0,3})(?:,?\s*(?:m\.?d\.?|md|do|d\.?o\.?))?\b/i,
    /\b([a-z][a-z.'-]+(?:\s+[a-z][a-z.'-]+){1,3}),?\s*(?:m\.?d\.?|md|do|d\.?o\.?)\b/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    const name = match?.[1]?.trim();
    if (name) return titleCaseName(name.replace(/\b(?:md|m\.d\.|do|d\.o\.)\b/gi, "").trim());
  }
  return "";
}

function cleanupAppointmentTitle(title: string, doctorName: string) {
  let cleaned = title.trim();
  if (doctorName) {
    const escapedName = escapeRegExp(doctorName).replace(/\s+/g, "\\s+");
    cleaned = cleaned
      .replace(new RegExp(`\\bwith\\s+dr\\.?\\s+${escapedName}(?:,?\\s*(?:m\\.?d\\.?|md|do|d\\.?o\\.?))?`, "i"), "")
      .replace(new RegExp(`\\bdr\\.?\\s+${escapedName}(?:,?\\s*(?:m\\.?d\\.?|md|do|d\\.?o\\.?))?`, "i"), "")
      .replace(new RegExp(`\\b${escapedName},?\\s*(?:m\\.?d\\.?|md|do|d\\.?o\\.?)`, "i"), "");
  }
  cleaned = cleaned
    .replace(/\bappointment\b/gi, "Appointment")
    .replace(/\s+[-–—]\s*$/g, "")
    .replace(/^\s*[-–—]\s+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned || /^appointment$/i.test(cleaned)) return "Appointment";
  return cleaned;
}

function cleanupNotes(notes: string, phone: string) {
  let cleaned = notes.trim();
  if (phone) {
    cleaned = cleaned.replace(phone, "").replace(/\b(?:phone|tel|call)\s*:?\s*$/gim, "");
  }
  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

function extractPhone(value: string) {
  const match = value.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
  return match?.[0]?.trim() ?? "";
}

function findDoctorMatch(name: string, doctors: Doctor[]) {
  const normalized = normalizeDoctorName(name);
  if (!normalized) return null;
  return doctors.find((doctor) => normalizeDoctorName(doctor.name) === normalized) ?? null;
}

function normalizeDoctorName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(dr|doctor|md|m\.d\.|do|d\.o\.)\b/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : part)
    .join(" ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildImportedNotes(draft: Draft) {
  return [
    draft.title.trim() ? `Visit: ${draft.title.trim()}` : "",
    draft.phone.trim() ? `Phone: ${draft.phone.trim()}` : "",
    draft.notes.trim(),
  ].filter(Boolean).join("\n\n");
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  styles,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, multiline && styles.notesInput]}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        placeholder={label}
        placeholderTextColor="#8B8B93"
      />
    </View>
  );
}

function emptyDraft(): Draft {
  return { doctorId: null, doctorName: "", title: "", date: "", time: "09:00", location: "", notes: "", phone: "" };
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingBottom: 14, backgroundColor: C.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
    headerText: { flex: 1 },
    eyebrow: { color: C.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
    title: { color: C.text, fontSize: 24, fontWeight: "800" },
    content: { padding: 18, gap: 14 },
    helperText: { color: C.textSecondary, fontSize: 15, lineHeight: 21, marginBottom: 2 },
    section: { gap: 10 },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionTitle: { color: C.text, fontSize: 14, fontWeight: "800", textTransform: "uppercase" },
    sectionCount: { minWidth: 28, height: 28, borderRadius: 14, overflow: "hidden", textAlign: "center", textAlignVertical: "center", color: C.textSecondary, backgroundColor: C.surfaceElevated, fontSize: 13, fontWeight: "800" },
    collapsedHeader: { minHeight: 58, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    collapsedHint: { color: C.textSecondary, fontSize: 13, fontWeight: "600", marginTop: 3 },
    emptySection: { minHeight: 58, borderRadius: 16, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
    emptySectionText: { color: C.textSecondary, fontSize: 14, fontWeight: "700", textAlign: "center" },
    centerState: { minHeight: 360, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 18 },
    stateTitle: { color: C.text, fontSize: 21, fontWeight: "800", textAlign: "center" },
    stateText: { color: C.textSecondary, fontSize: 15, lineHeight: 21, textAlign: "center" },
    stateFootnote: { color: C.textTertiary, fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: 2 },
    stateActions: { alignItems: "center", gap: 10, marginTop: 6 },
    primarySettingsButton: { minHeight: 50, borderRadius: 16, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: C.tint },
    primarySettingsButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
    secondaryButton: { minHeight: 48, borderRadius: 16, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border, marginTop: 6 },
    secondaryButtonText: { color: C.text, fontSize: 16, fontWeight: "800" },
    eventCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
    dateBadge: { width: 48, height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
    dateDay: { color: C.text, fontSize: 20, fontWeight: "800" },
    dateMonth: { color: C.textSecondary, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
    eventText: { flex: 1, minWidth: 0, gap: 3 },
    eventTitle: { color: C.text, fontSize: 17, fontWeight: "800" },
    eventMeta: { color: C.textSecondary, fontSize: 14, fontWeight: "600" },
    eventLocation: { color: C.textTertiary, fontSize: 13, fontWeight: "600" },
    row: { flexDirection: "row", gap: 12 },
    field: { flex: 1, gap: 7 },
    ownerRow: { flexDirection: "row", gap: 8, backgroundColor: C.surface, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border },
    ownerChip: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
    ownerChipActive: { backgroundColor: C.tint },
    ownerChipText: { color: C.textSecondary, fontSize: 14, fontWeight: "800" },
    ownerChipTextActive: { color: "#FFFFFF" },
    doctorChips: { gap: 8, paddingRight: 8 },
    doctorChip: { minHeight: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 13, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
    doctorChipActive: { backgroundColor: C.tintLight, borderColor: C.tint },
    doctorChipText: { color: C.textSecondary, fontSize: 13, fontWeight: "800" },
    doctorChipTextActive: { color: C.tint },
    smartHint: { color: C.textTertiary, fontSize: 12, fontWeight: "700", marginTop: -1 },
    label: { color: C.textSecondary, fontSize: 13, fontWeight: "700" },
    input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 16, fontWeight: "600" },
    notesInput: { minHeight: 130 },
    primaryButton: { minHeight: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, backgroundColor: C.purple, marginTop: 4 },
    primaryButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
    buttonPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  });
}

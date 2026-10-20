import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { raised } from "@/constants/raised";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  APPOINTMENT_REPEAT_OPTIONS,
  applyDoctorToDraft,
  appointmentGuidedProgress,
  buildAppointmentPayload,
  canContinueWhen,
  canContinueWho,
  canSaveAppointmentDraft,
  clearLinkedDoctor,
  createEmptyAppointmentDraft,
  dateStringToLocalDate,
  dateToTimeString,
  formatReadableDate,
  formatRecurrenceLabel,
  formatTime12h,
  localDateToDateString,
  nextAppointmentStep,
  previousAppointmentStep,
  timeStringToDate,
  type AddAppointmentDraft,
  type AppointmentGuidedStepId,
} from "@/lib/appointment-draft";
import { modalOverlay, modalSurface, modalSurfaceElevated } from "@/lib/modal-colors";
import {
  appointmentStorage,
  doctorsStorage,
  type Appointment,
  type Doctor,
  type RecordOwner,
  type RepeatUnit,
} from "@/lib/storage";
import { syncWidgetSnapshot } from "@/lib/widget-sync";

export type AddAppointmentGuidedFlowProps = {
  visible: boolean;
  initialOwner?: RecordOwner;
  initialDraft?: AddAppointmentDraft | null;
  initialStep?: AppointmentGuidedStepId;
  isCaregiver: boolean;
  caredForName?: string;
  doctors: Doctor[];
  scanEnabled: boolean;
  calendarImportEnabled?: boolean;
  onRequestScan: () => void;
  onRequestCalendarImport: () => void;
  onClose: () => void;
  onSaved: (apt: Appointment, options: { addAnother: boolean; openDetails: boolean }) => void;
  onDoctorsChanged?: (doctors: Doctor[]) => void;
};

const CUSTOM_REPEAT_UNITS: { value: RepeatUnit; label: string }[] = [
  { value: "day", label: "Days" },
  { value: "week", label: "Weeks" },
  { value: "month", label: "Months" },
];

type PickerKind = "date" | "startTime" | "endTime" | null;

function draftSnapshot(draft: AddAppointmentDraft): string {
  return JSON.stringify({
    doctorName: draft.doctorName.trim(),
    doctorId: draft.doctorId ?? "",
    specialty: draft.specialty.trim(),
    date: draft.date,
    time: draft.time,
    timeConfirmed: draft.timeConfirmed,
    endTime: draft.endTime,
    endTimeConfirmed: draft.endTimeConfirmed,
    location: draft.location.trim(),
    arrivalInstructions: draft.arrivalInstructions.trim(),
    notes: draft.notes.trim(),
    entryOwner: draft.entryOwner,
    repeatOption: draft.repeatOption,
    customInterval: draft.customInterval,
    customUnit: draft.customUnit,
  });
}

function seedDraft(props: AddAppointmentGuidedFlowProps): AddAppointmentDraft {
  if (props.initialDraft) {
    const base = createEmptyAppointmentDraft(props.initialOwner ?? props.initialDraft.entryOwner ?? "self");
    return { ...base, ...props.initialDraft };
  }
  return createEmptyAppointmentDraft(props.initialOwner ?? "self");
}

export default function AddAppointmentGuidedFlow(props: AddAppointmentGuidedFlowProps) {
  const {
    visible,
    initialOwner,
    isCaregiver,
    caredForName,
    doctors,
    scanEnabled,
    calendarImportEnabled = true,
    onRequestScan,
    onRequestCalendarImport,
    onClose,
    onSaved,
    onDoctorsChanged,
  } = props;

  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [draft, setDraft] = useState<AddAppointmentDraft>(() => seedDraft(props));
  const [step, setStep] = useState<AppointmentGuidedStepId>("who");
  const [savedAppointment, setSavedAppointment] = useState<Appointment | null>(null);
  const [baselineSnapshot, setBaselineSnapshot] = useState("");
  const [saving, setSaving] = useState(false);

  const [doctorSearch, setDoctorSearch] = useState("");
  const [showAddDoctorForm, setShowAddDoctorForm] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState("");
  const [newDoctorHospital, setNewDoctorHospital] = useState("");
  const [newDoctorPhone, setNewDoctorPhone] = useState("");
  const [showNotesField, setShowNotesField] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerKind>(null);

  const ownerLocked = initialOwner != null;
  const showOwnerChips = isCaregiver && Boolean(caredForName?.trim()) && !ownerLocked;
  const progress = appointmentGuidedProgress(step);

  const doctorsForOwner = useMemo(
    () => doctors.filter((d) => (d.entryOwner ?? "self") === draft.entryOwner),
    [doctors, draft.entryOwner],
  );

  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    const list = doctorsForOwner;
    if (!q) return list.slice(0, 12);
    return list.filter((d) => d.name.toLowerCase().includes(q) || (d.specialty ?? "").toLowerCase().includes(q)).slice(0, 12);
  }, [doctorSearch, doctorsForOwner]);

  useEffect(() => {
    if (!visible) return;
    const nextDraft = seedDraft(props);
    if (props.initialOwner != null) {
      nextDraft.entryOwner = props.initialOwner;
    }
    setDraft(nextDraft);
    setBaselineSnapshot(draftSnapshot(nextDraft));
    const startStep = props.initialStep ?? "who";
    setStep(startStep === "success" ? "review" : startStep);
    setSavedAppointment(null);
    setDoctorSearch("");
    setShowAddDoctorForm(false);
    setNewDoctorName("");
    setNewDoctorSpecialty("");
    setNewDoctorHospital("");
    setNewDoctorPhone("");
    setShowNotesField(Boolean(nextDraft.notes.trim()));
    setActivePicker(null);
  }, [visible, initialOwner, props.initialDraft, props.initialStep]);

  const updateDraft = useCallback((patch: Partial<AddAppointmentDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const hasUnsavedChanges = useMemo(() => draftSnapshot(draft) !== baselineSnapshot, [draft, baselineSnapshot]);

  const requestClose = useCallback(() => {
    if (step === "success") {
      onClose();
      return;
    }
    if (hasUnsavedChanges) {
      Alert.alert("Discard changes?", "Your appointment details will not be saved.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onClose },
      ]);
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose, step]);

  const canContinue = useMemo(() => {
    if (step === "who") return canContinueWho(draft);
    if (step === "when") return canContinueWhen(draft);
    if (step === "where") return true;
    if (step === "review") return canSaveAppointmentDraft(draft);
    return true;
  }, [draft, step]);

  const goNext = useCallback(() => {
    if (!canContinue) return;
    const next = nextAppointmentStep(step);
    if (next && next !== "success") {
      setStep(next);
      void Haptics.selectionAsync().catch(() => {});
    }
  }, [canContinue, step]);

  const goBack = useCallback(() => {
    const prev = previousAppointmentStep(step);
    if (prev && prev !== "success") {
      setStep(prev);
      void Haptics.selectionAsync().catch(() => {});
      return;
    }
    requestClose();
  }, [requestClose, step]);

  const handleSaveNewDoctor = useCallback(async () => {
    if (!newDoctorName.trim()) return;
    try {
      const doctor = await doctorsStorage.save(
        {
          name: newDoctorName.trim(),
          specialty: newDoctorSpecialty.trim() || undefined,
          hospital: newDoctorHospital.trim() || undefined,
          phone: newDoctorPhone.trim() || undefined,
          entryOwner: draft.entryOwner,
        },
        draft.entryOwner,
      );
      const refreshed = [...doctors.filter((d) => d.id !== doctor.id), doctor].sort((a, b) => a.name.localeCompare(b.name));
      onDoctorsChanged?.(refreshed);
      setDraft((prev) => applyDoctorToDraft(prev, doctor));
      setShowAddDoctorForm(false);
      setNewDoctorName("");
      setNewDoctorSpecialty("");
      setNewDoctorHospital("");
      setNewDoctorPhone("");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn("Failed to save doctor", error);
      Alert.alert("Something went wrong", "We could not save this doctor. Please try again.");
    }
  }, [draft.entryOwner, doctors, newDoctorHospital, newDoctorName, newDoctorPhone, newDoctorSpecialty, onDoctorsChanged]);

  const persistAppointment = useCallback(async (): Promise<Appointment | null> => {
    if (!canSaveAppointmentDraft(draft) || saving) return null;
    setSaving(true);
    try {
      const payload = buildAppointmentPayload(draft);
      const saved = await appointmentStorage.save(payload);
      try {
        const { recordMilestone } = await import("@/lib/product-milestones");
        await recordMilestone("first_appointment_added");
        await recordMilestone("first_useful_action");
      } catch {
        /* non-fatal */
      }
      await syncWidgetSnapshot().catch(() => {});
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSavedAppointment(saved);
      setBaselineSnapshot(draftSnapshot(draft));
      return saved;
    } catch (error) {
      console.warn("Failed to save appointment", error);
      Alert.alert("Something went wrong", "We could not save this appointment. Please try again.");
      return null;
    } finally {
      setSaving(false);
    }
  }, [draft, saving]);

  const handleSave = useCallback(async () => {
    const saved = await persistAppointment();
    if (!saved) return;
    setStep("success");
  }, [persistAppointment]);

  const setEntryOwner = useCallback(
    (owner: RecordOwner) => {
      setDraft((prev) => {
        const next = { ...prev, entryOwner: owner };
        if (prev.doctorId) {
          const stillValid = doctors.some((d) => d.id === prev.doctorId && (d.entryOwner ?? "self") === owner);
          if (!stillValid) return clearLinkedDoctor(next);
        }
        return next;
      });
      void Haptics.selectionAsync().catch(() => {});
    },
    [doctors],
  );

  const recurrenceLabel = useMemo(() => formatRecurrenceLabel(draft), [draft]);

  const renderProgressDots = () => {
    if (step === "success") return null;
    const { index, total } = progress;
    return (
      <View
        style={styles.progressRow}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: index + 1 }}
      >
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.progressDot, i === index && styles.progressDotActive]} />
        ))}
      </View>
    );
  };

  const renderOwnerChips = () => {
    if (!showOwnerChips) return null;
    const options: { value: RecordOwner; label: string }[] = [
      { value: "self", label: "You" },
      { value: "care_recipient", label: caredForName!.trim() },
    ];
    return (
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Who is this appointment for?</Text>
        <View style={styles.chipRow}>
          {options.map((opt) => {
            const selected = draft.entryOwner === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setEntryOwner(opt.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Appointment for ${opt.label}`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderWhoStep = () => (
    <>
      <Text style={styles.stepTitle}>Who is your appointment with?</Text>
      {renderOwnerChips()}
      <Text style={styles.fieldLabel}>Search your doctors</Text>
      <TextInput
        style={styles.input}
        placeholder="Search by name or specialty"
        placeholderTextColor={C.textTertiary}
        value={doctorSearch}
        onChangeText={setDoctorSearch}
        autoCorrect={false}
        accessibilityLabel="Search doctors"
      />
      {filteredDoctors.length > 0 && (
        <View style={styles.suggestionList}>
          {filteredDoctors.map((doc) => {
            const selected = draft.doctorId === doc.id;
            return (
              <Pressable
                key={doc.id}
                style={[styles.suggestionRow, selected && styles.suggestionRowSelected]}
                onPress={() => {
                  setDraft((prev) => applyDoctorToDraft(prev, doc));
                  void Haptics.selectionAsync().catch(() => {});
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Select doctor ${doc.name}`}
              >
                <Text style={styles.suggestionText}>{doc.name}</Text>
                {doc.specialty ? <Text style={styles.suggestionSubtext}>{doc.specialty}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      )}
      <Text style={styles.fieldLabel}>Or enter a name</Text>
      <TextInput
        style={styles.input}
        placeholder="Doctor or provider name"
        placeholderTextColor={C.textTertiary}
        value={draft.doctorName}
        onChangeText={(t) => {
          setDraft((prev) => (prev.doctorId ? clearLinkedDoctor(prev, t) : { ...prev, doctorName: t }));
        }}
        autoCorrect={false}
        accessibilityLabel="Appointment provider name"
      />
      <Pressable
        style={styles.textButton}
        onPress={() => setShowAddDoctorForm((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Add new doctor"
        accessibilityState={{ expanded: showAddDoctorForm }}
      >
        <Ionicons name={showAddDoctorForm ? "chevron-up" : "add-circle-outline"} size={20} color={C.tint} />
        <Text style={styles.textButtonLabel}>{showAddDoctorForm ? "Hide new doctor form" : "Add new doctor"}</Text>
      </Pressable>
      {showAddDoctorForm && (
        <View style={styles.inlineCard}>
          <Text style={styles.fieldLabel}>Name (required)</Text>
          <TextInput
            style={styles.input}
            placeholder="Dr. Smith"
            placeholderTextColor={C.textTertiary}
            value={newDoctorName}
            onChangeText={setNewDoctorName}
            accessibilityLabel="New doctor name"
          />
          <Text style={styles.fieldLabel}>Specialty (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Cardiology"
            placeholderTextColor={C.textTertiary}
            value={newDoctorSpecialty}
            onChangeText={setNewDoctorSpecialty}
            accessibilityLabel="New doctor specialty"
          />
          <Text style={styles.fieldLabel}>Hospital (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Clinic or hospital"
            placeholderTextColor={C.textTertiary}
            value={newDoctorHospital}
            onChangeText={setNewDoctorHospital}
            accessibilityLabel="New doctor hospital"
          />
          <Text style={styles.fieldLabel}>Phone (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            placeholderTextColor={C.textTertiary}
            value={newDoctorPhone}
            onChangeText={setNewDoctorPhone}
            keyboardType="phone-pad"
            accessibilityLabel="New doctor phone"
          />
          <Pressable
            style={[styles.primaryButtonCompact, !newDoctorName.trim() && styles.bottomPrimaryDisabled]}
            onPress={() => void handleSaveNewDoctor()}
            disabled={!newDoctorName.trim()}
            accessibilityRole="button"
            accessibilityLabel="Save new doctor"
          >
            <Text style={styles.primaryButtonText}>Save doctor</Text>
          </Pressable>
        </View>
      )}
      {scanEnabled && (
        <Pressable
          style={styles.secondaryButton}
          onPress={onRequestScan}
          accessibilityRole="button"
          accessibilityLabel="Scan appointment details"
        >
          <Ionicons name="scan-outline" size={18} color={C.tint} />
          <Text style={styles.secondaryButtonText}>Scan</Text>
        </Pressable>
      )}
      {calendarImportEnabled && (
        <Pressable
          style={styles.secondaryButton}
          onPress={onRequestCalendarImport}
          accessibilityRole="button"
          accessibilityLabel="Import from calendar"
        >
          <Ionicons name="calendar-outline" size={18} color={C.tint} />
          <Text style={styles.secondaryButtonText}>Import from Calendar</Text>
        </Pressable>
      )}
    </>
  );

  const renderWhenStep = () => (
    <>
      <Text style={styles.stepTitle}>When is your appointment?</Text>
      <Text style={styles.fieldLabel}>Date</Text>
      <Pressable
        style={[styles.input, styles.pressableInput]}
        onPress={() => setActivePicker("date")}
        accessibilityRole="button"
        accessibilityLabel="Choose appointment date"
      >
        <Text style={styles.inputText}>{formatReadableDate(draft.date)}</Text>
      </Pressable>
      {Platform.OS === "ios" && activePicker === "date" && (
        <View style={styles.inlinePicker}>
          <DateTimePicker
            value={dateStringToLocalDate(draft.date)}
            mode="date"
            display="spinner"
            onChange={(_, date) => {
              if (date) updateDraft({ date: localDateToDateString(date) });
            }}
          />
          <Pressable style={styles.primaryButtonCompact} onPress={() => setActivePicker(null)}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.fieldLabel}>Time</Text>
      <Pressable
        style={[styles.input, styles.pressableInput]}
        onPress={() => setActivePicker("startTime")}
        accessibilityRole="button"
        accessibilityLabel="Choose appointment time"
      >
        <Text style={[styles.inputText, !draft.timeConfirmed && styles.placeholderText]}>
          {draft.timeConfirmed && draft.time.trim() ? formatTime12h(draft.time) : "Choose a time"}
        </Text>
      </Pressable>
      {Platform.OS === "ios" && activePicker === "startTime" && (
        <View style={styles.inlinePicker}>
          <DateTimePicker
            value={draft.timeConfirmed && draft.time ? timeStringToDate(draft.time) : new Date()}
            mode="time"
            display="spinner"
            onChange={(_, date) => {
              if (!date) return;
              updateDraft({ time: dateToTimeString(date), timeConfirmed: true });
            }}
          />
          <Pressable style={styles.primaryButtonCompact} onPress={() => setActivePicker(null)}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Add end time (optional)</Text>
        <Switch
          value={draft.endTimeConfirmed}
          onValueChange={(v) => {
            if (v) {
              updateDraft({ endTimeConfirmed: true, endTime: draft.endTime || draft.time || "" });
            } else {
              updateDraft({ endTimeConfirmed: false, endTime: "" });
            }
          }}
          trackColor={{ false: C.border, true: C.tint }}
          thumbColor={Platform.OS === "android" ? "#fff" : undefined}
          accessibilityRole="switch"
          accessibilityLabel="Add end time"
          accessibilityState={{ checked: draft.endTimeConfirmed }}
        />
      </View>
      {draft.endTimeConfirmed && (
        <>
          <Text style={styles.fieldLabel}>End time</Text>
          <Pressable
            style={[styles.input, styles.pressableInput]}
            onPress={() => setActivePicker("endTime")}
            accessibilityRole="button"
            accessibilityLabel="Choose appointment end time"
          >
            <Text style={[styles.inputText, !draft.endTime.trim() && styles.placeholderText]}>
              {draft.endTime.trim() ? formatTime12h(draft.endTime) : "Choose end time"}
            </Text>
          </Pressable>
          {Platform.OS === "ios" && activePicker === "endTime" && (
            <View style={styles.inlinePicker}>
              <DateTimePicker
                value={draft.endTime ? timeStringToDate(draft.endTime) : timeStringToDate(draft.time || "12:00")}
                mode="time"
                display="spinner"
                onChange={(_, date) => {
                  if (!date) return;
                  updateDraft({ endTime: dateToTimeString(date), endTimeConfirmed: true });
                }}
              />
              <Pressable style={styles.primaryButtonCompact} onPress={() => setActivePicker(null)}>
                <Text style={styles.primaryButtonText}>Done</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
      <Text style={styles.fieldLabel}>Repeats</Text>
      <View style={styles.chipRowWrap}>
        {APPOINTMENT_REPEAT_OPTIONS.map((opt) => {
          const selected = draft.repeatOption === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => {
                updateDraft({ repeatOption: opt.value });
                void Haptics.selectionAsync().catch(() => {});
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Repeat ${opt.label}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {draft.repeatOption === "custom" && (
        <View style={styles.rowInputs}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Every</Text>
            <TextInput
              style={styles.input}
              value={draft.customInterval}
              onChangeText={(t) => updateDraft({ customInterval: t })}
              keyboardType="number-pad"
              accessibilityLabel="Custom repeat interval"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Unit</Text>
            <View style={styles.chipRow}>
              {CUSTOM_REPEAT_UNITS.map((unit) => {
                const selected = draft.customUnit === unit.value;
                return (
                  <Pressable
                    key={unit.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => updateDraft({ customUnit: unit.value })}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{unit.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      )}
      {recurrenceLabel ? <Text style={styles.helperText}>{recurrenceLabel}</Text> : null}
    </>
  );

  const renderWhereStep = () => (
    <>
      <Text style={styles.stepTitle}>Where will you go?</Text>
      {draft.doctorDefaultLocation.trim() ? (
        <Pressable
          style={[styles.chip, styles.suggestedLocationChip]}
          onPress={() => updateDraft({ location: draft.doctorDefaultLocation })}
          accessibilityRole="button"
          accessibilityLabel={`Use suggested location ${draft.doctorDefaultLocation}`}
        >
          <Ionicons name="location-outline" size={16} color={C.tint} />
          <Text style={styles.suggestedLocationText}>Use {draft.doctorDefaultLocation}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.fieldLabel}>Location</Text>
      <TextInput
        style={styles.input}
        placeholder="Address, clinic, or hospital"
        placeholderTextColor={C.textTertiary}
        value={draft.location}
        onChangeText={(t) => updateDraft({ location: t })}
        accessibilityLabel="Appointment location"
      />
      <Text style={styles.fieldLabel}>Arrival instructions (optional)</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder="Parking, check-in desk, etc."
        placeholderTextColor={C.textTertiary}
        value={draft.arrivalInstructions}
        onChangeText={(t) => updateDraft({ arrivalInstructions: t })}
        multiline
        accessibilityLabel="Arrival instructions"
      />
      {!showNotesField ? (
        <Pressable
          style={styles.textButton}
          onPress={() => setShowNotesField(true)}
          accessibilityRole="button"
          accessibilityLabel="Add notes"
        >
          <Text style={styles.textButtonLabel}>Add notes (optional)</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Anything to remember"
            placeholderTextColor={C.textTertiary}
            value={draft.notes}
            onChangeText={(t) => updateDraft({ notes: t })}
            multiline
            accessibilityLabel="Appointment notes"
          />
        </>
      )}
    </>
  );

  const whenSummary = useMemo(() => {
    const parts = [formatReadableDate(draft.date)];
    if (draft.timeConfirmed && draft.time) {
      parts.push(formatTime12h(draft.time));
      if (draft.endTimeConfirmed && draft.endTime.trim()) {
        parts.push(`– ${formatTime12h(draft.endTime)}`);
      }
    }
    const recur = formatRecurrenceLabel(draft);
    if (recur) parts.push(recur);
    return parts.join(" · ");
  }, [draft]);

  const renderReviewStep = () => {
    const whoValue = [draft.doctorName.trim(), draft.specialty.trim()].filter(Boolean).join("\n") || "—";
    const whereParts = [draft.location.trim(), draft.arrivalInstructions.trim()].filter(Boolean);
    const whereValue = whereParts.length ? whereParts.join("\n") : "—";
    const rows: { label: string; value: string; target: AppointmentGuidedStepId }[] = [
      { label: "Who", value: whoValue, target: "who" },
      { label: "When", value: whenSummary, target: "when" },
      { label: "Where", value: whereValue, target: "where" },
    ];
    if (draft.notes.trim()) {
      rows.push({ label: "Notes", value: draft.notes.trim(), target: "where" });
    }
    return (
      <>
        <Text style={styles.stepTitle}>Everything look right?</Text>
        {rows.map((row) => (
          <Pressable
            key={row.label}
            style={styles.summaryRow}
            onPress={() => setStep(row.target)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${row.label}`}
          >
            <Text style={styles.summaryLabel}>{row.label}</Text>
            <Text style={styles.summaryValue}>{row.value}</Text>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </Pressable>
        ))}
      </>
    );
  };

  const renderSuccessStep = () => {
    const apt = savedAppointment;
    if (!apt) return null;
    return (
      <>
        <Text style={styles.stepTitle}>Appointment added</Text>
        <Text style={styles.helperText}>
          {apt.doctorName}
          {apt.date ? `\n${formatReadableDate(apt.date)}` : ""}
          {apt.time ? ` · ${formatTime12h(apt.time)}` : ""}
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            onSaved(apt, { addAnother: false, openDetails: false });
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.primaryButtonText}>Done</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            onSaved(apt, { addAnother: true, openDetails: false });
            const owner = initialOwner ?? draft.entryOwner;
            const fresh = createEmptyAppointmentDraft(owner);
            setDraft(fresh);
            setBaselineSnapshot(draftSnapshot(fresh));
            setSavedAppointment(null);
            setStep("who");
          }}
          accessibilityRole="button"
          accessibilityLabel="Add another appointment"
        >
          <Text style={styles.secondaryButtonText}>Add another</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            onSaved(apt, { addAnother: false, openDetails: true });
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Add more appointment details"
        >
          <Text style={styles.secondaryButtonText}>Add more details</Text>
        </Pressable>
      </>
    );
  };

  const renderStepContent = () => {
    if (step === "who") return renderWhoStep();
    if (step === "when") return renderWhenStep();
    if (step === "where") return renderWhereStep();
    if (step === "review") return renderReviewStep();
    if (step === "success") return renderSuccessStep();
    return null;
  };

  const showBottomBar = step !== "success";
  const primaryActionLabel = step === "review" ? "Save Appointment" : "Continue";

  const handleAndroidPickerChange = useCallback(
    (kind: PickerKind, date?: Date) => {
      if (!date || !kind) return;
      if (kind === "date") {
        updateDraft({ date: localDateToDateString(date) });
      } else if (kind === "startTime") {
        updateDraft({ time: dateToTimeString(date), timeConfirmed: true });
      } else if (kind === "endTime") {
        updateDraft({ endTime: dateToTimeString(date), endTimeConfirmed: true });
      }
      setActivePicker(null);
    },
    [updateDraft],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={requestClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={requestClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close add appointment">
            <Ionicons name="close" size={28} color={C.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Add appointment</Text>
          <View style={{ width: 28 }} />
        </View>
        {renderProgressDots()}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: showBottomBar ? insets.bottom + 100 : insets.bottom + 32 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderStepContent()}
          </ScrollView>
        </KeyboardAvoidingView>
        {showBottomBar && (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              style={styles.bottomSecondary}
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel={step === "who" ? "Cancel" : "Back"}
            >
              <Text style={styles.bottomSecondaryText}>{step === "who" ? "Cancel" : "Back"}</Text>
            </Pressable>
            <Pressable
              style={[styles.bottomPrimary, !canContinue && styles.bottomPrimaryDisabled]}
              onPress={() => {
                if (step === "review") {
                  void handleSave();
                } else {
                  goNext();
                }
              }}
              disabled={!canContinue || saving}
              accessibilityRole="button"
              accessibilityLabel={primaryActionLabel}
            >
              <Text style={styles.bottomPrimaryText}>{primaryActionLabel}</Text>
            </Pressable>
          </View>
        )}
      </View>
      {Platform.OS !== "ios" && activePicker && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setActivePicker(null)}>
          <View style={styles.pickerOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setActivePicker(null)} accessibilityLabel="Close picker" />
            <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16 }]}>
              <DateTimePicker
                value={
                  activePicker === "date"
                    ? dateStringToLocalDate(draft.date)
                    : activePicker === "endTime"
                      ? draft.endTime
                        ? timeStringToDate(draft.endTime)
                        : timeStringToDate(draft.time || "12:00")
                      : draft.timeConfirmed && draft.time
                        ? timeStringToDate(draft.time)
                        : new Date()
                }
                mode={activePicker === "date" ? "date" : "time"}
                display="default"
                onChange={(_, date) => handleAndroidPickerChange(activePicker, date)}
              />
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

function makeStyles(C: Theme) {
  const surface = modalSurface(C);
  const elevated = modalSurfaceElevated(C);
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: surface,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: C.text,
    },
    progressRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.border,
    },
    progressDotActive: {
      backgroundColor: C.tint,
      width: 20,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 8,
    },
    stepTitle: {
      fontSize: 30,
      fontWeight: "700",
      color: C.text,
      letterSpacing: -0.5,
      marginBottom: 20,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: C.textSecondary,
      marginBottom: 8,
    },
    helperText: {
      fontSize: 14,
      color: C.textSecondary,
      marginTop: 8,
      lineHeight: 20,
      marginBottom: 8,
    },
    input: {
      fontSize: 16,
      color: C.text,
      backgroundColor: elevated,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 14,
    },
    inputMultiline: {
      minHeight: 72,
      textAlignVertical: "top",
    },
    pressableInput: {
      justifyContent: "center",
    },
    inputText: {
      fontSize: 16,
      color: C.text,
    },
    placeholderText: {
      color: C.textTertiary,
    },
    section: {
      marginBottom: 8,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    chipRowWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: elevated,
    },
    chipSelected: {
      borderColor: C.tint,
      backgroundColor: C.tintLight,
    },
    chipText: {
      fontSize: 14,
      color: C.textSecondary,
      fontWeight: "500",
    },
    chipTextSelected: {
      color: C.tint,
      fontWeight: "600",
    },
    suggestionList: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 16,
      overflow: "hidden",
    },
    suggestionRow: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
      backgroundColor: elevated,
    },
    suggestionRowSelected: {
      backgroundColor: C.tintLight,
    },
    suggestionText: {
      fontSize: 15,
      color: C.text,
      fontWeight: "500",
    },
    suggestionSubtext: {
      fontSize: 13,
      color: C.textSecondary,
      marginTop: 2,
    },
    inlineCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      padding: 16,
      marginBottom: 16,
    },
    secondaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      marginBottom: 8,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: C.tint,
    },
    textButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      marginBottom: 12,
    },
    textButtonLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: C.tint,
    },
    suggestedLocationChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      marginBottom: 14,
      borderColor: C.tint,
      backgroundColor: C.tintLight,
    },
    suggestedLocationText: {
      fontSize: 14,
      color: C.tint,
      fontWeight: "600",
      flexShrink: 1,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginVertical: 8,
      paddingVertical: 8,
    },
    switchLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: "500",
      color: C.text,
      paddingRight: 12,
    },
    rowInputs: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 8,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: elevated,
      padding: 16,
      marginBottom: 12,
      gap: 8,
    },
    summaryLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: C.textSecondary,
      width: 56,
    },
    summaryValue: {
      flex: 1,
      fontSize: 15,
      color: C.text,
      lineHeight: 21,
    },
    primaryButton: {
      marginTop: 16,
      backgroundColor: C.tint,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      ...raised("md", C.tint),
    },
    primaryButtonCompact: {
      marginTop: 8,
      backgroundColor: C.tint,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#fff",
    },
    bottomBar: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 24,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      backgroundColor: surface,
    },
    bottomSecondary: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: elevated,
    },
    bottomSecondaryText: {
      fontSize: 16,
      fontWeight: "600",
      color: C.textSecondary,
    },
    bottomPrimary: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: C.tint,
      ...raised("md", C.tint),
    },
    bottomPrimaryDisabled: {
      opacity: 0.45,
    },
    bottomPrimaryText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#fff",
    },
    inlinePicker: {
      marginBottom: 12,
    },
    pickerOverlay: {
      flex: 1,
      backgroundColor: modalOverlay(),
      justifyContent: "flex-end",
    },
    pickerSheet: {
      backgroundColor: surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: C.border,
    },
  });
}

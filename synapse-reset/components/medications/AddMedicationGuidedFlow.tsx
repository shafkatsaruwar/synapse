import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { raised } from "@/constants/raised";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  buildMedicationPayload,
  canContinueHow,
  canContinueIdentity,
  canContinueWhen,
  canSaveDraft,
  createEmptyDraft,
  createEmptyDose,
  draftFromMedication,
  defaultReminderTimeFor,
  formatMedicationFrequencyLabel,
  formatReminderTimeDisplay,
  guidedProgress,
  GUIDED_DOSE_UNITS,
  nextGuidedStep,
  previousGuidedStep,
  timeTagsForSettings,
  WEEKDAY_OPTIONS,
  type AddMedicationDraft,
  type GuidedDoseDraft,
  type GuidedStepId,
  type MedicationReminderCadence,
} from "@/lib/medication-draft";
import { modalOverlay, modalSurface, modalSurfaceElevated } from "@/lib/modal-colors";
import { syncAllFromSettings } from "@/lib/notification-manager";
import {
  medicationLogStorage,
  medicationStorage,
  normalizeMedication,
  type Medication,
  type RecordOwner,
} from "@/lib/storage";
import { syncWidgetSnapshot } from "@/lib/widget-sync";

export type AddMedicationGuidedFlowProps = {
  visible: boolean;
  mode: "add" | "edit";
  editingMedication?: Medication | null;
  initialOwner?: RecordOwner;
  initialDraft?: AddMedicationDraft | null;
  initialStep?: GuidedStepId;
  ramadanMode: boolean;
  isCaregiver: boolean;
  caredForName?: string;
  nameSuggestions: string[];
  scanEnabled: boolean;
  onRequestScan: () => void;
  onClose: () => void;
  onSaved: (med: Medication, options: { logPrn: boolean; openAdvanced: boolean; addAnother: boolean }) => void;
  onOpenAdvancedDetails: (med: Medication) => void;
};

const REMINDER_INTERVAL_UNITS = [
  { value: "days" as const, label: "Days" },
  { value: "weeks" as const, label: "Weeks" },
];

function reminderTimeToDate(str: string): Date {
  const [h, m] = (str || "08:00").split(":").map((n) => parseInt(n, 10) || 0);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToReminderTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function makeTagColors(C: Theme): Record<string, { bg: string; text: string }> {
  return {
    Morning: { bg: C.tintLight, text: C.tint },
    Afternoon: { bg: C.yellowLight, text: C.yellow },
    Night: { bg: C.purpleLight, text: C.purple },
    "Before Fajr": { bg: C.accentLight, text: C.accent },
    "After Iftar": { bg: C.orangeLight, text: C.orange },
    "As Needed": { bg: C.surfaceElevated, text: C.textSecondary },
  };
}

function draftSnapshot(draft: AddMedicationDraft): string {
  return JSON.stringify({
    name: draft.name.trim(),
    doses: draft.doses.map((d) => ({
      id: d.id,
      amount: d.amount.trim(),
      unit: d.unit.trim(),
      timeOfDay: d.timeOfDay,
      reminderTime: d.reminderTime,
      optionalNotes: d.optionalNotes.trim(),
    })),
  });
}

function seedDraft(props: AddMedicationGuidedFlowProps): AddMedicationDraft {
  if (props.mode === "edit" && props.editingMedication) {
    return draftFromMedication(props.editingMedication);
  }
  if (props.initialDraft) {
    const base = createEmptyDraft(props.initialOwner ?? props.initialDraft.entryOwner ?? "self");
    return { ...base, ...props.initialDraft, doses: props.initialDraft.doses?.length ? props.initialDraft.doses : base.doses };
  }
  const owner = props.initialOwner ?? "self";
  return createEmptyDraft(owner);
}

export default function AddMedicationGuidedFlow(props: AddMedicationGuidedFlowProps) {
  const {
    visible,
    mode,
    editingMedication,
    initialOwner,
    initialStep,
    ramadanMode,
    isCaregiver,
    caredForName,
    nameSuggestions,
    scanEnabled,
    onRequestScan,
    onClose,
    onSaved,
    onOpenAdvancedDetails,
  } = props;

  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C), [C]);
  const tagColors = useMemo(() => makeTagColors(C), [C]);
  const timeTags = useMemo(() => timeTagsForSettings(ramadanMode), [ramadanMode]);

  const [draft, setDraft] = useState<AddMedicationDraft>(() => seedDraft(props));
  const [step, setStep] = useState<GuidedStepId>("identity");
  const [savedMedication, setSavedMedication] = useState<Medication | null>(null);
  const [baselineSnapshot, setBaselineSnapshot] = useState("");
  const [showCadenceOptions, setShowCadenceOptions] = useState(false);
  const [reminderPickerDoseId, setReminderPickerDoseId] = useState<string | null>(null);
  const [customUnitMode, setCustomUnitMode] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const ownerLocked = initialOwner != null;
  const showOwnerChips = isCaregiver && Boolean(caredForName?.trim()) && !ownerLocked;
  const isPrn = draft.medicationType === "prn";
  const progress = guidedProgress(step === "success" ? "review" : step, draft.medicationType);
  const filteredSuggestions = useMemo(() => {
    const q = draft.name.trim().toLowerCase();
    if (!q) return nameSuggestions.slice(0, 8);
    return nameSuggestions.filter((n) => n.toLowerCase().includes(q)).slice(0, 8);
  }, [draft.name, nameSuggestions]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const nextDraft = seedDraft(props);
    if (props.initialOwner != null) {
      nextDraft.entryOwner = props.initialOwner;
    }
    setDraft(nextDraft);
    setBaselineSnapshot(draftSnapshot(nextDraft));
    const startStep = props.initialStep ?? "identity";
    setStep(startStep === "success" ? "review" : startStep);
    setSavedMedication(null);
    setShowCadenceOptions(
      nextDraft.reminderCadence === "weekly" ||
        nextDraft.reminderCadence === "biweekly" ||
        nextDraft.reminderCadence === "custom",
    );
    setReminderPickerDoseId(null);
    setCustomUnitMode({});
  }, [
    visible,
    mode,
    editingMedication?.id,
    initialOwner,
    props.initialDraft,
    props.initialStep,
  ]);

  const updateDraft = useCallback((patch: Partial<AddMedicationDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateDose = useCallback((doseId: string, patch: Partial<GuidedDoseDraft>) => {
    setDraft((prev) => ({
      ...prev,
      doses: prev.doses.map((d) => (d.id === doseId ? { ...d, ...patch } : d)),
    }));
  }, []);

  const hasUnsavedChanges = useMemo(() => draftSnapshot(draft) !== baselineSnapshot, [draft, baselineSnapshot]);

  const requestClose = useCallback(() => {
    if (step === "success") {
      onClose();
      return;
    }
    if (hasUnsavedChanges) {
      Alert.alert("Discard changes?", "Your medication details will not be saved.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onClose },
      ]);
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose, step]);

  const handlePickPhoto = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Let Synapse access your photos so you can attach the med box or pill photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    updateDraft({ imageUri: result.assets[0].uri });
    void Haptics.selectionAsync().catch(() => {});
  }, [updateDraft]);

  const setMedicationType = useCallback(
    (type: "scheduled" | "prn") => {
      void Haptics.selectionAsync().catch(() => {});
      if (type === "prn") {
        setDraft((prev) => ({
          ...prev,
          medicationType: "prn",
          doses: [
            createEmptyDose({
              amount: prev.doses[0]?.amount ?? "",
              unit: prev.doses[0]?.unit ?? "mg",
              timeOfDay: "As Needed",
              reminderTime: "",
            }),
          ],
          remindersEnabled: false,
        }));
      } else {
        setDraft((prev) => ({
          ...prev,
          medicationType: "scheduled",
          doses: prev.doses.length > 0
            ? prev.doses.map((d) => ({
                ...d,
                timeOfDay: d.timeOfDay === "As Needed" ? "Morning" : d.timeOfDay || "Morning",
              }))
            : [createEmptyDose()],
          remindersEnabled: prev.remindersEnabled,
        }));
      }
    },
    [],
  );

  const addDose = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      doses: [...prev.doses, createEmptyDose({ timeOfDay: "Morning" })],
    }));
    void Haptics.selectionAsync().catch(() => {});
  }, []);

  const removeDose = useCallback((doseId: string) => {
    setDraft((prev) => {
      if (prev.doses.length <= 1) return prev;
      return { ...prev, doses: prev.doses.filter((d) => d.id !== doseId) };
    });
  }, []);

  const canContinue = useMemo(() => {
    if (step === "identity") return canContinueIdentity(draft);
    if (step === "how") return canContinueHow(draft);
    if (step === "when") return canContinueWhen(draft);
    if (step === "review") return canSaveDraft(draft);
    return true;
  }, [draft, step]);

  const goNext = useCallback(() => {
    if (!canContinue) return;
    const next = nextGuidedStep(step, draft.medicationType);
    if (next) {
      setStep(next);
      void Haptics.selectionAsync().catch(() => {});
    }
  }, [canContinue, draft.medicationType, step]);

  const goBack = useCallback(() => {
    const prev = previousGuidedStep(step, draft.medicationType);
    if (prev) {
      setStep(prev);
      void Haptics.selectionAsync().catch(() => {});
      return;
    }
    requestClose();
  }, [draft.medicationType, requestClose, step]);

  const persistMedication = useCallback(
    async (logPrn: boolean): Promise<Medication | null> => {
      if (!canSaveDraft(draft) || saving) return null;
      setSaving(true);
      try {
        const data = buildMedicationPayload(draft, { existing: editingMedication ?? null });
        let saved: Medication;
        if (mode === "edit" && editingMedication) {
          await medicationStorage.update(editingMedication.id, data);
          saved = normalizeMedication({ ...editingMedication, ...data, id: editingMedication.id });
        } else {
          saved = normalizeMedication(await medicationStorage.save(data));
          try {
            const { recordMilestone } = await import("@/lib/product-milestones");
            await recordMilestone("first_medication_configured");
            await recordMilestone("first_useful_action");
          } catch {
            /* non-fatal */
          }
        }
        if (logPrn && saved.medicationType === "prn") {
          await medicationLogStorage.logPrnDose(saved.id);
        }
        await syncAllFromSettings();
        await syncWidgetSnapshot().catch(() => {});
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSavedMedication(saved);
        setBaselineSnapshot(draftSnapshot(draft));
        return saved;
      } catch (error) {
        console.warn("Failed to save medication", error);
        Alert.alert("Something went wrong", "We could not save this medication. Please try again.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [draft, editingMedication, mode, saving],
  );

  const handleSave = useCallback(
    async (logPrn = false) => {
      const saved = await persistMedication(logPrn);
      if (!saved) return;
      if (mode === "edit") {
        onSaved(saved, { logPrn, openAdvanced: false, addAnother: false });
        onClose();
        return;
      }
      setStep("success");
    },
    [mode, onClose, onSaved, persistMedication],
  );

  const primaryActionLabel = useMemo(() => {
    if (step === "review") return mode === "edit" ? "Save Medication" : "Save Medication";
    if (step === "when" || step === "how" || step === "identity") return "Continue";
    return "Continue";
  }, [mode, step]);

  const renderProgressDots = () => {
    if (step === "success") return null;
    const { index, total } = progress;
    return (
      <View style={styles.progressRow} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: index + 1 }}>
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
        <Text style={styles.fieldLabel}>Who is this for?</Text>
        <View style={styles.chipRow}>
          {options.map((opt) => {
            const selected = draft.entryOwner === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => {
                  updateDraft({ entryOwner: opt.value });
                  void Haptics.selectionAsync().catch(() => {});
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Medication for ${opt.label}`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderUnitChips = (dose: GuidedDoseDraft) => {
    const isCustom = customUnitMode[dose.id] || !GUIDED_DOSE_UNITS.includes(dose.unit as (typeof GUIDED_DOSE_UNITS)[number]);
    return (
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Unit</Text>
        <View style={styles.chipRowWrap}>
          {GUIDED_DOSE_UNITS.map((unit) => {
            const selected = !isCustom && dose.unit === unit;
            return (
              <Pressable
                key={unit}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => {
                  setCustomUnitMode((m) => ({ ...m, [dose.id]: false }));
                  updateDose(dose.id, { unit });
                  void Haptics.selectionAsync().catch(() => {});
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{unit}</Text>
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.chip, isCustom && styles.chipSelected]}
            onPress={() => setCustomUnitMode((m) => ({ ...m, [dose.id]: true }))}
            accessibilityRole="button"
            accessibilityState={{ selected: isCustom }}
          >
            <Text style={[styles.chipText, isCustom && styles.chipTextSelected]}>Custom</Text>
          </Pressable>
        </View>
        {isCustom && (
          <TextInput
            style={styles.input}
            placeholder="Enter unit"
            placeholderTextColor={C.textTertiary}
            value={dose.unit}
            onChangeText={(t) => updateDose(dose.id, { unit: t })}
            accessibilityLabel="Custom dose unit"
          />
        )}
      </View>
    );
  };

  const renderDoseEditor = (dose: GuidedDoseDraft, index: number, options: { showTimeOfDay: boolean; showNotes: boolean }) => {
    const tone = tagColors[dose.timeOfDay] ?? { bg: C.surfaceElevated, text: C.textSecondary };
    return (
      <View key={dose.id} style={styles.doseCard}>
        <View style={styles.doseCardHeader}>
          <Text style={styles.doseCardTitle}>Dose {index + 1}</Text>
          {!isPrn && draft.doses.length > 1 && (
            <Pressable
              onPress={() => removeDose(dose.id)}
              accessibilityRole="button"
              accessibilityLabel={`Remove dose ${index + 1}`}
              hitSlop={8}
            >
              <Text style={styles.textButtonDanger}>Remove</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.fieldLabel}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 10"
          placeholderTextColor={C.textTertiary}
          value={dose.amount}
          onChangeText={(t) => updateDose(dose.id, { amount: t })}
          keyboardType="decimal-pad"
          accessibilityLabel={`Dose ${index + 1} amount`}
        />
        {renderUnitChips(dose)}
        {options.showTimeOfDay && (
          <>
            <Text style={styles.fieldLabel}>Time of day</Text>
            <View style={styles.chipRowWrap}>
              {timeTags.map((tag) => {
                const selected = dose.timeOfDay === tag;
                const colors = tagColors[tag] ?? tone;
                return (
                  <Pressable
                    key={tag}
                    style={[
                      styles.chip,
                      selected && { backgroundColor: colors.bg, borderColor: colors.text },
                    ]}
                    onPress={() => {
                      updateDose(dose.id, { timeOfDay: tag, reminderTime: defaultReminderTimeFor(tag) });
                      void Haptics.selectionAsync().catch(() => {});
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipText, selected && { color: colors.text, fontWeight: "600" }]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        {options.showNotes && (
          <>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Anything helpful to remember"
              placeholderTextColor={C.textTertiary}
              value={dose.optionalNotes}
              onChangeText={(t) => updateDose(dose.id, { optionalNotes: t })}
              multiline
              accessibilityLabel={`Dose ${index + 1} notes`}
            />
          </>
        )}
      </View>
    );
  };

  const renderIdentityStep = () => (
    <>
      <Text style={styles.stepTitle}>What medication are you adding?</Text>
      {renderOwnerChips()}
      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Levothyroxine"
        placeholderTextColor={C.textTertiary}
        value={draft.name}
        onChangeText={(t) => updateDraft({ name: t })}
        autoCorrect={false}
        accessibilityLabel="Medication name"
      />
      {filteredSuggestions.length > 0 && (
        <View style={styles.suggestionList}>
          {filteredSuggestions.map((name) => (
            <Pressable
              key={name}
              style={styles.suggestionRow}
              onPress={() => {
                updateDraft({ name });
                void Haptics.selectionAsync().catch(() => {});
              }}
              accessibilityRole="button"
            >
              <Text style={styles.suggestionText}>{name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={styles.fieldLabel}>Photo (optional)</Text>
      {draft.imageUri ? (
        <View style={styles.photoRow}>
          <Image source={{ uri: draft.imageUri }} style={styles.photoPreview} accessibilityLabel="Medication photo" />
          <Pressable
            style={styles.secondaryButton}
            onPress={() => updateDraft({ imageUri: "" })}
            accessibilityRole="button"
            accessibilityLabel="Remove medication photo"
          >
            <Text style={styles.secondaryButtonText}>Remove photo</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.secondaryButton} onPress={handlePickPhoto} accessibilityRole="button" accessibilityLabel="Add medication photo">
          <Ionicons name="image-outline" size={18} color={C.tint} />
          <Text style={styles.secondaryButtonText}>Add photo</Text>
        </Pressable>
      )}
      {scanEnabled && (
        <Pressable
          style={[styles.secondaryButton, { marginTop: 12 }]}
          onPress={onRequestScan}
          accessibilityRole="button"
          accessibilityLabel="Scan medication label"
        >
          <Ionicons name="scan-outline" size={18} color={C.tint} />
          <Text style={styles.secondaryButtonText}>Scan label</Text>
        </Pressable>
      )}
    </>
  );

  const renderHowStep = () => (
    <>
      <Text style={styles.stepTitle}>How do you take it?</Text>
      <View style={styles.choiceStack}>
        <Pressable
          style={[styles.choiceCard, draft.medicationType === "scheduled" && styles.choiceCardActive]}
          onPress={() => setMedicationType("scheduled")}
          accessibilityRole="button"
          accessibilityState={{ selected: draft.medicationType === "scheduled" }}
        >
          <Text style={[styles.choiceTitle, draft.medicationType === "scheduled" && styles.choiceTitleActive]}>On a schedule</Text>
          <Text style={styles.choiceBody}>Take at specific times</Text>
        </Pressable>
        <Pressable
          style={[styles.choiceCard, draft.medicationType === "prn" && styles.choiceCardActive]}
          onPress={() => setMedicationType("prn")}
          accessibilityRole="button"
          accessibilityState={{ selected: draft.medicationType === "prn" }}
        >
          <Text style={[styles.choiceTitle, draft.medicationType === "prn" && styles.choiceTitleActive]}>Only when needed</Text>
          <Text style={styles.choiceBody}>As needed (PRN)</Text>
        </Pressable>
      </View>
      {draft.medicationType && (
        <>
          {isPrn ? (
            renderDoseEditor(draft.doses[0] ?? createEmptyDose({ timeOfDay: "As Needed" }), 0, { showTimeOfDay: false, showNotes: true })
          ) : (
            <>
              {draft.doses.map((dose, idx) => renderDoseEditor(dose, idx, { showTimeOfDay: true, showNotes: true }))}
              <Pressable style={styles.textButton} onPress={addDose} accessibilityRole="button" accessibilityLabel="Add another dose">
                <Ionicons name="add-circle-outline" size={20} color={C.tint} />
                <Text style={styles.textButtonLabel}>Add dose</Text>
              </Pressable>
            </>
          )}
          {!isPrn && (
            <>
              <Text style={styles.fieldLabel}>Route (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Oral"
                placeholderTextColor={C.textTertiary}
                value={draft.route}
                onChangeText={(t) => updateDraft({ route: t })}
                accessibilityLabel="Medication route"
              />
            </>
          )}
        </>
      )}
    </>
  );

  const renderCadenceSection = () => {
    const parsedInterval = Math.max(1, parseInt(draft.reminderIntervalValue, 10) || 1);
    const frequencyPreview = formatMedicationFrequencyLabel(
      draft.reminderCadence,
      draft.reminderWeekday,
      parsedInterval,
      draft.reminderIntervalUnit,
    );
    const needsWeekday =
      draft.reminderCadence === "weekly" ||
      draft.reminderCadence === "biweekly" ||
      (draft.reminderCadence === "custom" && draft.reminderIntervalUnit === "weeks");

    return (
      <>
        <Text style={styles.fieldLabel}>How often?</Text>
        <Pressable
          style={[styles.choiceCard, draft.reminderCadence === "daily" && !showCadenceOptions && styles.choiceCardActive]}
          onPress={() => {
            updateDraft({ reminderCadence: "daily" });
            setShowCadenceOptions(false);
            void Haptics.selectionAsync().catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: draft.reminderCadence === "daily" }}
        >
          <Text style={[styles.choiceTitle, draft.reminderCadence === "daily" && styles.choiceTitleActive]}>Daily</Text>
          <Text style={styles.choiceBody}>Every day</Text>
        </Pressable>
        {!showCadenceOptions ? (
          <Pressable
            style={styles.textButton}
            onPress={() => setShowCadenceOptions(true)}
            accessibilityRole="button"
            accessibilityLabel="Show more repeat options"
          >
            <Text style={styles.textButtonLabel}>More options</Text>
          </Pressable>
        ) : (
          <View style={styles.chipRowWrap}>
            {(["weekly", "biweekly", "custom"] as MedicationReminderCadence[]).map((cadence) => {
              const selected = draft.reminderCadence === cadence;
              const label = cadence === "weekly" ? "Weekly" : cadence === "biweekly" ? "Every 2 weeks" : "Custom";
              return (
                <Pressable
                  key={cadence}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => {
                    updateDraft({ reminderCadence: cadence });
                    void Haptics.selectionAsync().catch(() => {});
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {draft.reminderCadence === "custom" && showCadenceOptions && (
          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Every</Text>
              <TextInput
                style={styles.input}
                value={draft.reminderIntervalValue}
                onChangeText={(t) => updateDraft({ reminderIntervalValue: t })}
                keyboardType="number-pad"
                accessibilityLabel="Custom interval value"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Unit</Text>
              <View style={styles.chipRow}>
                {REMINDER_INTERVAL_UNITS.map((unit) => {
                  const selected = draft.reminderIntervalUnit === unit.value;
                  return (
                    <Pressable
                      key={unit.value}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => updateDraft({ reminderIntervalUnit: unit.value })}
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
        {needsWeekday && (
          <>
            <Text style={styles.fieldLabel}>Day of week</Text>
            <View style={styles.chipRowWrap}>
              {WEEKDAY_OPTIONS.map((day) => {
                const selected = draft.reminderWeekday === day.value;
                return (
                  <Pressable
                    key={day.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => updateDraft({ reminderWeekday: day.value })}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{day.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        <Text style={styles.helperText}>{frequencyPreview}</Text>
      </>
    );
  };

  const renderWhenStep = () => (
    <>
      <Text style={styles.stepTitle}>When do you take it?</Text>
      {draft.doses
        .filter((d) => d.amount.trim())
        .map((dose, index) => (
          <View key={dose.id} style={styles.doseCard}>
            <Text style={styles.doseCardTitle}>
              {dose.amount.trim()} {dose.unit.trim() || "mg"}
            </Text>
            <Text style={styles.fieldLabel}>Time of day</Text>
            <View style={styles.chipRowWrap}>
              {timeTags.map((tag) => {
                const selected = dose.timeOfDay === tag;
                const colors = tagColors[tag] ?? { bg: C.surfaceElevated, text: C.textSecondary };
                return (
                  <Pressable
                    key={`${dose.id}-${tag}`}
                    style={[styles.chip, selected && { backgroundColor: colors.bg, borderColor: colors.text }]}
                    onPress={() => updateDose(dose.id, { timeOfDay: tag })}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipText, selected && { color: colors.text, fontWeight: "600" }]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
            {index === 0 ? null : <View style={{ height: 4 }} />}
          </View>
        ))}
      {renderCadenceSection()}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Would you like reminders?</Text>
        <Switch
          value={draft.remindersEnabled}
          onValueChange={(v) => updateDraft({ remindersEnabled: v })}
          trackColor={{ false: C.border, true: C.tint }}
          thumbColor={Platform.OS === "android" ? "#fff" : undefined}
          accessibilityRole="switch"
          accessibilityLabel="Medication reminders"
          accessibilityState={{ checked: draft.remindersEnabled }}
        />
      </View>
      {draft.remindersEnabled &&
        draft.doses
          .filter((d) => d.amount.trim())
          .map((dose, idx) => (
            <View key={`rem-${dose.id}`} style={styles.section}>
              <Text style={styles.fieldLabel}>
                Reminder for dose {idx + 1} ({dose.timeOfDay})
              </Text>
              <Pressable
                style={[styles.input, styles.pressableInput]}
                onPress={() => setReminderPickerDoseId(dose.id)}
                accessibilityRole="button"
                accessibilityLabel={`Set reminder time for dose ${idx + 1}`}
              >
                <Text style={styles.inputText}>{formatReminderTimeDisplay(dose.reminderTime)}</Text>
              </Pressable>
              {Platform.OS === "ios" && reminderPickerDoseId === dose.id && (
                <View style={styles.inlinePicker}>
                  <DateTimePicker
                    value={reminderTimeToDate(dose.reminderTime)}
                    mode="time"
                    display="spinner"
                    onChange={(_, date) => {
                      if (!date) return;
                      updateDose(dose.id, { reminderTime: dateToReminderTime(date) });
                    }}
                  />
                  <Pressable style={styles.primaryButtonCompact} onPress={() => setReminderPickerDoseId(null)}>
                    <Text style={styles.primaryButtonText}>Done</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
    </>
  );

  const summaryFrequency = useMemo(() => {
    const parsed = Math.max(1, parseInt(draft.reminderIntervalValue, 10) || 1);
    return isPrn ? "As needed" : formatMedicationFrequencyLabel(draft.reminderCadence, draft.reminderWeekday, parsed, draft.reminderIntervalUnit);
  }, [draft, isPrn]);

  const renderReviewStep = () => {
    const doseSummary = draft.doses
      .filter((d) => d.amount.trim())
      .map((d) => `${d.amount.trim()} ${d.unit.trim() || "mg"} · ${d.timeOfDay}`)
      .join("\n");
    const rows: { label: string; value: string; step: GuidedStepId }[] = [
      { label: "Medication", value: draft.name.trim() || "—", step: "identity" },
      { label: "How", value: isPrn ? "Only when needed" : `Scheduled\n${doseSummary}`, step: "how" },
    ];
    if (!isPrn) {
      rows.push({
        label: "When",
        value: `${summaryFrequency}${draft.remindersEnabled ? "\nReminders on" : "\nReminders off"}`,
        step: "when",
      });
    }
    return (
      <>
        <Text style={styles.stepTitle}>Everything look right?</Text>
        {rows.map((row) => (
          <Pressable
            key={row.label}
            style={styles.summaryRow}
            onPress={() => setStep(row.step)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${row.label}`}
          >
            <Text style={styles.summaryLabel}>{row.label}</Text>
            <Text style={styles.summaryValue}>{row.value}</Text>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </Pressable>
        ))}
        {mode === "add" && isPrn && (
          <Pressable
            style={[styles.secondaryButton, { marginTop: 8 }]}
            onPress={() => handleSave(true)}
            disabled={!canSaveDraft(draft) || saving}
            accessibilityRole="button"
            accessibilityLabel="Save medication and log a dose"
          >
            <Text style={styles.secondaryButtonText}>Save and log a dose</Text>
          </Pressable>
        )}
      </>
    );
  };

  const renderSuccessStep = () => {
    const med = savedMedication;
    if (!med) return null;
    return (
      <>
        <Text style={styles.stepTitle}>{mode === "edit" ? "Medication updated" : "Medication added"}</Text>
        <Text style={styles.helperText}>{med.name}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            onSaved(med, { logPrn: false, openAdvanced: false, addAnother: false });
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.primaryButtonText}>Done</Text>
        </Pressable>
        {mode === "add" && (
          <>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                onSaved(med, { logPrn: false, openAdvanced: false, addAnother: true });
                const owner = initialOwner ?? draft.entryOwner;
                const fresh = createEmptyDraft(owner);
                setDraft(fresh);
                setBaselineSnapshot(draftSnapshot(fresh));
                setSavedMedication(null);
                setStep("identity");
              }}
              accessibilityRole="button"
              accessibilityLabel="Add another medication"
            >
              <Text style={styles.secondaryButtonText}>Add another</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                onSaved(med, { logPrn: false, openAdvanced: true, addAnother: false });
                onOpenAdvancedDetails(med);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Add more medication details"
            >
              <Text style={styles.secondaryButtonText}>Add more details</Text>
            </Pressable>
          </>
        )}
        {mode === "edit" && (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              onSaved(med, { logPrn: false, openAdvanced: true, addAnother: false });
              onOpenAdvancedDetails(med);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Add more medication details"
          >
            <Text style={styles.secondaryButtonText}>Add more details</Text>
          </Pressable>
        )}
      </>
    );
  };

  const renderStepContent = () => {
    if (step === "identity") return renderIdentityStep();
    if (step === "how") return renderHowStep();
    if (step === "when") return renderWhenStep();
    if (step === "review") return renderReviewStep();
    if (step === "success") return renderSuccessStep();
    return null;
  };

  const showBottomBar = step !== "success";

  const reminderDose = reminderPickerDoseId ? draft.doses.find((d) => d.id === reminderPickerDoseId) : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={requestClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            onPress={requestClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close add medication"
          >
            <Ionicons name="close" size={28} color={C.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{mode === "edit" ? "Edit medication" : "Add medication"}</Text>
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
              accessibilityLabel={step === "identity" ? "Cancel" : "Back"}
            >
              <Text style={styles.bottomSecondaryText}>{step === "identity" ? "Cancel" : "Back"}</Text>
            </Pressable>
            <Pressable
              style={[styles.bottomPrimary, !canContinue && styles.bottomPrimaryDisabled]}
              onPress={() => {
                if (step === "review") {
                  void handleSave(false);
                } else {
                  goNext();
                }
              }}
              disabled={!canContinue || saving}
              accessibilityRole="button"
              accessibilityLabel={primaryActionLabel}
            >
              <Text style={styles.bottomPrimaryText}>{step === "review" ? "Save Medication" : "Continue"}</Text>
            </Pressable>
          </View>
        )}
      </View>
      {Platform.OS !== "ios" && reminderDose && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setReminderPickerDoseId(null)}>
          <View style={styles.pickerOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setReminderPickerDoseId(null)} accessibilityLabel="Close time picker" />
            <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.fieldLabel}>Reminder time</Text>
              <DateTimePicker
                value={reminderTimeToDate(reminderDose.reminderTime)}
                mode="time"
                display="default"
                onChange={(_, date) => {
                  if (date) {
                    updateDose(reminderDose.id, { reminderTime: dateToReminderTime(date) });
                  }
                  setReminderPickerDoseId(null);
                }}
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
    suggestionText: {
      fontSize: 15,
      color: C.text,
    },
    photoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    photoPreview: {
      width: 72,
      height: 72,
      borderRadius: 12,
      backgroundColor: elevated,
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
    choiceStack: {
      gap: 12,
      marginBottom: 20,
    },
    choiceCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: elevated,
      padding: 18,
    },
    choiceCardActive: {
      borderColor: C.tint,
      backgroundColor: C.tintLight,
    },
    choiceTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: C.text,
      marginBottom: 4,
    },
    choiceTitleActive: {
      color: C.tint,
    },
    choiceBody: {
      fontSize: 14,
      color: C.textSecondary,
    },
    doseCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      padding: 16,
      marginBottom: 14,
    },
    doseCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    doseCardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: C.text,
      marginBottom: 8,
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
    textButtonDanger: {
      fontSize: 14,
      fontWeight: "600",
      color: C.red,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginVertical: 16,
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
      width: 88,
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

import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, Platform, Alert, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { getSickModePalette, type SickModePalette } from "@/constants/sick-mode-colors";
import ReadAloudButton from "@/components/ReadAloudButton";
import * as Crypto from "expo-crypto";
import {
  medicationStorage, medicationLogStorage, settingsStorage, sickModeStorage, doctorsStorage,
  type Medication, type MedicationDose, type MedicationLog, type UserSettings, type SickModeData, type Doctor,
} from "@/lib/storage";
import { getMedList, addMedListItem, removeMedListItem, updateMedListItem, type MedListItem, type MedListDose, type MedListDoseTime } from "@/lib/med-list-storage";
import { getToday } from "@/lib/date-utils";
import { DEFAULT_REMINDER_TIMES } from "@/lib/notification-manager";
import DateTimePicker from "@react-native-community/datetimepicker";

const TIME_TAGS: string[] = ["Morning", "Afternoon", "Night", "Before Fajr", "After Iftar"];
const MED_LIST_DOSE_TIMES: MedListDoseTime[] = ["Morning", "Afternoon", "Evening", "Night", "As Needed"];

/** Default reminder time string (HH:mm) for a time-of-day label. */
function defaultReminderTimeFor(timeOfDay: string): string {
  const t = DEFAULT_REMINDER_TIMES[timeOfDay] ?? DEFAULT_REMINDER_TIMES["Morning"];
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}
/** Parse "HH:mm" to a Date (today at that time). */
function reminderTimeToDate(str: string): Date {
  const [h, m] = (str || "08:00").split(":").map((n) => parseInt(n, 10) || 0);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
/** Format Date to "HH:mm". */
function dateToReminderTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
/** Format "HH:mm" for display (e.g. "8:00 AM"). */
function formatReminderTimeDisplay(hhmm: string): string {
  const [h, m] = (hhmm || "08:00").split(":").map((n) => parseInt(n, 10) || 0);
  const hour = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function makeTagColors(C: Theme): Record<string, { bg: string; text: string; icon: string }> {
  return {
    Morning: { bg: C.tintLight, text: C.tint, icon: "sunny-outline" },
    Afternoon: { bg: C.yellowLight, text: C.yellow, icon: "partly-sunny-outline" },
    Night: { bg: C.purpleLight, text: C.purple, icon: "moon-outline" },
    "Before Fajr": { bg: C.accentLight, text: C.accent, icon: "moon-outline" },
    "After Iftar": { bg: C.orangeLight, text: C.orange, icon: "restaurant-outline" },
  };
}

const ROUTE_EMOJIS: Record<string, string> = {
  oral: "💊", tablet: "💊", capsule: "💊", chewable: "💊",
  injection: "💉", "IM injection": "💉", "SubQ injection": "💉", subcutaneous: "💉", intramuscular: "💉",
  inhaler: "🫁", diskus: "🫁", nebulizer: "🫁",
  topical: "🧴", cream: "🧴", ointment: "🧴", patch: "🩹",
  drops: "💧", eye: "👁️", ear: "👂",
  suppository: "💊", liquid: "🥤", sublingual: "💊",
};

const EMOJI_OPTIONS = ["💊", "💉", "🫁", "🧴", "🩹", "💧", "🥤", "🧬", "❤️", "🧠", "🦴", "🩺", "⚡", "🌙", "☀️", "🍽️"];

function getAutoEmoji(med: Medication): string {
  if (med.emoji) return med.emoji;
  const doseStr = Array.isArray(med.doses) && med.doses.length > 0
    ? med.doses.map((d) => `${d.amount} ${d.unit}`).join(" ")
    : (med as { dosage?: string }).dosage ?? "";
  const searchText = `${med.route || ""} ${doseStr}`.toLowerCase();
  for (const [key, emoji] of Object.entries(ROUTE_EMOJIS)) {
    if (searchText.includes(key.toLowerCase())) return emoji;
  }
  return "💊";
}

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C, themeId } = useTheme();
  const sickPalette = useMemo(() => getSickModePalette(themeId), [themeId]);
  const styles = useMemo(() => makeStyles(C, sickPalette), [C, sickPalette]);
  const TAG_COLORS = useMemo(() => makeTagColors(C), [C]);
  const today = getToday();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false, sickMode: false });
  const [sickData, setSickData] = useState<SickModeData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [nudgeMedId, setNudgeMedId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formDosesArray, setFormDosesArray] = useState<Array<{ id: string; amount: string; unit: string; timeOfDay: string; reminderTime: string; optionalNotes: string }>>([
    { id: "", amount: "", unit: "mg", timeOfDay: "Morning", reminderTime: "08:00", optionalNotes: "" },
  ]);
  const [showReminderTimePickerIndex, setShowReminderTimePickerIndex] = useState<number | null>(null);
  const [formRoute, setFormRoute] = useState("");
  const [formFreq, setFormFreq] = useState("");
  const [formEmoji, setFormEmoji] = useState("");
  const [formHasStressDose, setFormHasStressDose] = useState(false);
  const [showDoseTimePickerIndex, setShowDoseTimePickerIndex] = useState<number | null>(null);
  const [formStressDoseAmount, setFormStressDoseAmount] = useState("");
  const [formStressDoseFrequency, setFormStressDoseFrequency] = useState("");
  const [formStressDoseDurationDays, setFormStressDoseDurationDays] = useState("");
  const [formStressDoseInstructions, setFormStressDoseInstructions] = useState("");
  const [formTotalPills, setFormTotalPills] = useState("");
  const [formPillsRemaining, setFormPillsRemaining] = useState("");
  const [tempInput, setTempInput] = useState("");
  const [showTempModal, setShowTempModal] = useState(false);

  const [medListItems, setMedListItems] = useState<MedListItem[]>([]);
  const [editingMedListItem, setEditingMedListItem] = useState<MedListItem | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showMedListModal, setShowMedListModal] = useState(false);
  const [showMedListDoctorPicker, setShowMedListDoctorPicker] = useState(false);
  const [showMedListDoseTimePickerIndex, setShowMedListDoseTimePickerIndex] = useState<number | null>(null);
  const [showCurrentMedNamePicker, setShowCurrentMedNamePicker] = useState(false);
  const [formMedListName, setFormMedListName] = useState("");
  const [formMedListDoses, setFormMedListDoses] = useState<{ dosage: string; time: MedListDoseTime }[]>([{ dosage: "", time: "Morning" }]);
  const [formMedListPrescribingDoctor, setFormMedListPrescribingDoctor] = useState("");
  const [formMedListPharmacyName, setFormMedListPharmacyName] = useState("");
  const [formMedListPharmacyPhone, setFormMedListPharmacyPhone] = useState("");
  const [formMedListPharmacyAddress, setFormMedListPharmacyAddress] = useState("");
  const [formMedListRefills, setFormMedListRefills] = useState("");
  const [formMedListDuration, setFormMedListDuration] = useState("");
  const [formMedListDurationUnit, setFormMedListDurationUnit] = useState<"" | "Days" | "Weeks" | "Months">("");

  const loadData = useCallback(async () => {
    const [meds, logs, s, sd, medList, docs] = await Promise.all([
      medicationStorage.getAll(), medicationLogStorage.getByDate(today), settingsStorage.get(), sickModeStorage.get(), getMedList(), doctorsStorage.getAll(),
    ]);
    setMedications(meds);
    setMedLogs(logs);
    setSettings(s);
    setSickData(sd);
    setMedListItems(medList);
    setDoctors(docs);
  }, [today]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const resetMedListForm = () => {
    setFormMedListName("");
    setFormMedListDoses([{ dosage: "", time: "Morning" }]);
    setFormMedListPrescribingDoctor("");
    setFormMedListPharmacyName("");
    setFormMedListPharmacyPhone("");
    setFormMedListPharmacyAddress("");
    setFormMedListRefills("");
    setFormMedListDuration("");
    setFormMedListDurationUnit("");
  };

  const openMedListAddModal = () => {
    setEditingMedListItem(null);
    resetMedListForm();
    setShowMedListDoctorPicker(false);
    setShowMedListModal(true);
  };

  const openEditMedListItem = (item: MedListItem) => {
    setEditingMedListItem(item);
    setFormMedListName(item.name);
    setFormMedListDoses(item.doses?.length ? [...item.doses] : [{ dosage: (item as unknown as { dosage?: string }).dosage ?? "", time: "Morning" }]);
    setFormMedListPrescribingDoctor(item.prescribingDoctor);
    setFormMedListPharmacyName(item.pharmacyName);
    setFormMedListPharmacyPhone(item.pharmacyPhone);
    setFormMedListPharmacyAddress(item.pharmacyAddress);
    setFormMedListRefills(item.refillsRemaining > 0 ? String(item.refillsRemaining) : "");
    setFormMedListDuration(item.duration != null ? String(item.duration) : "");
    setFormMedListDurationUnit(item.durationUnit ?? "");
    setShowMedListDoctorPicker(false);
    setShowMedListModal(true);
  };

  const openAddModal = () => {
    setEditingMed(null);
    setFormName("");
    setFormDosesArray([{ id: Crypto.randomUUID(), amount: "", unit: "mg", timeOfDay: "Morning", reminderTime: "08:00", optionalNotes: "" }]);
    setFormRoute("");
    setFormFreq("");
    setFormEmoji("");
    setFormHasStressDose(false);
    setFormStressDoseAmount("");
    setFormStressDoseFrequency("");
    setFormStressDoseDurationDays("");
    setFormStressDoseInstructions("");
    setFormTotalPills("");
    setFormPillsRemaining("");
    setShowCurrentMedNamePicker(false);
    setShowDoseTimePickerIndex(null);
    setShowReminderTimePickerIndex(null);
    setShowModal(true);
  };

  const openEditModal = (med: Medication) => {
    setEditingMed(med);
    setFormName(med.name);
    const doses = Array.isArray(med.doses) && med.doses.length > 0
      ? med.doses.map((d) => ({ id: d.id, amount: d.amount, unit: d.unit, timeOfDay: d.timeOfDay, reminderTime: d.reminderTime ?? defaultReminderTimeFor(d.timeOfDay), optionalNotes: d.optionalNotes ?? "" }))
      : [{ id: Crypto.randomUUID(), amount: (med as { dosage?: string }).dosage ?? "", unit: (med as { unit?: string }).unit ?? "mg", timeOfDay: "Morning", reminderTime: "08:00", optionalNotes: "" }];
    setFormDosesArray(doses);
    setFormRoute(med.route || "");
    setFormFreq(med.frequency);
    setFormEmoji(med.emoji || "");
    setFormHasStressDose(med.hasStressDose || false);
    setFormStressDoseAmount(med.stressDoseAmount || "");
    setFormStressDoseFrequency(med.stressDoseFrequency || "");
    setFormStressDoseDurationDays(med.stressDoseDurationDays ? String(med.stressDoseDurationDays) : "");
    setFormStressDoseInstructions(med.stressDoseInstructions || "");
    setFormTotalPills(med.totalPills != null ? String(med.totalPills) : "");
    setFormPillsRemaining(med.pillsRemaining != null ? String(med.pillsRemaining) : "");
    setShowDoseTimePickerIndex(null);
    setShowReminderTimePickerIndex(null);
    setShowModal(true);
  };

  const dosesWithAmount = formDosesArray.filter((d) => d.amount.trim().length > 0);
  const canSaveMedication =
    formName.trim().length > 0 &&
    dosesWithAmount.length > 0 &&
    !dosesWithAmount.some((d) => !d.reminderTime?.trim());

  const handleSave = async () => {
    if (!formName.trim()) return;
    const dosesWithAmount = formDosesArray.filter((d) => d.amount.trim().length > 0);
    if (dosesWithAmount.length === 0) return;
    const missingReminder = dosesWithAmount.some((d) => !d.reminderTime?.trim());
    if (missingReminder) {
      Alert.alert("Reminder time required", "Every dose must have a reminder time. Please set a time for each dose.");
      return;
    }
    const doses: MedicationDose[] = formDosesArray
      .map((d) => ({ id: d.id || Crypto.randomUUID(), amount: d.amount.trim(), unit: d.unit.trim() || "mg", timeOfDay: d.timeOfDay, reminderTime: (d.reminderTime?.trim() || defaultReminderTimeFor(d.timeOfDay)), optionalNotes: d.optionalNotes?.trim() || undefined }))
      .filter((d) => d.amount.length > 0);
    const parsedDuration = parseInt(formStressDoseDurationDays, 10);
    const totalPills = formTotalPills.trim() ? parseInt(formTotalPills, 10) : undefined;
    const pillsRemaining = formPillsRemaining.trim() ? parseInt(formPillsRemaining, 10) : undefined;
    const data: Omit<Medication, "id"> = {
      name: formName.trim(),
      frequency: formFreq.trim(),
      route: formRoute.trim(),
      emoji: formEmoji || "",
      doses,
      active: true,
      totalPills: totalPills != null && !isNaN(totalPills) ? totalPills : undefined,
      pillsRemaining: pillsRemaining != null && !isNaN(pillsRemaining) ? pillsRemaining : undefined,
      hasStressDose: formHasStressDose,
      stressDoseAmount: formHasStressDose ? formStressDoseAmount.trim() : undefined,
      stressDoseFrequency: formHasStressDose ? formStressDoseFrequency.trim() : undefined,
      stressDoseDurationDays: formHasStressDose && !isNaN(parsedDuration) ? parsedDuration : undefined,
      stressDoseInstructions: formHasStressDose ? formStressDoseInstructions.trim() : undefined,
    };
    if (editingMed) {
      await medicationStorage.update(editingMed.id, data);
    } else {
      await medicationStorage.save(data);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (med: Medication) => {
    if (Platform.OS === "web") { await medicationStorage.delete(med.id); loadData(); return; }
    Alert.alert("Remove", `Remove ${med.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { await medicationStorage.delete(med.id); loadData(); } },
    ]);
  };

  const handleSaveMedListItem = async () => {
    const name = formMedListName.trim();
    if (!name) return;
    const refills = parseInt(formMedListRefills, 10);
    const durationNum = formMedListDuration.trim() ? parseInt(formMedListDuration, 10) : undefined;
    const doses: MedListDose[] = formMedListDoses
      .map((d) => ({ dosage: d.dosage.trim(), time: d.time }))
      .filter((d) => d.dosage.length > 0);
    if (doses.length === 0) doses.push({ dosage: "", time: "Morning" });
    const payload = {
      name,
      doses,
      prescribingDoctor: formMedListPrescribingDoctor.trim(),
      pharmacyName: formMedListPharmacyName.trim(),
      pharmacyPhone: formMedListPharmacyPhone.trim(),
      pharmacyAddress: formMedListPharmacyAddress.trim(),
      refillsRemaining: isNaN(refills) || refills < 0 ? 0 : refills,
      duration: durationNum != null && !isNaN(durationNum) && durationNum > 0 ? durationNum : undefined,
      durationUnit: formMedListDurationUnit || undefined,
    };
    if (editingMedListItem) {
      await updateMedListItem({ ...payload, id: editingMedListItem.id });
    } else {
      await addMedListItem(payload);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowMedListModal(false);
    setEditingMedListItem(null);
    resetMedListForm();
    loadData();
  };

  const handleDeleteMedListItem = () => {
    if (!editingMedListItem) return;
    Alert.alert(
      "Delete",
      `Remove ${editingMedListItem.name} from the Medications List?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await removeMedListItem(editingMedListItem.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowMedListModal(false);
            setEditingMedListItem(null);
            resetMedListForm();
            loadData();
          },
        },
      ]
    );
  };

  const handleRemoveMedListItem = async (item: MedListItem) => {
    if (Platform.OS === "web") { await removeMedListItem(item.id); loadData(); return; }
    Alert.alert("Remove", `Remove ${item.name} from Med List?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { await removeMedListItem(item.id); loadData(); } },
    ]);
  };

  const handleDoseToggle = async (medId: string, doseIdx: number) => {
    const log = medLogs.find((l) => l.medicationId === medId && (l.doseIndex ?? 0) === doseIdx);
    if (log?.taken) {
      await medicationLogStorage.toggle(medId, today, doseIdx);
      Haptics.selectionAsync();
    } else {
      await medicationLogStorage.toggle(medId, today, doseIdx);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    loadData();
  };

  const handleNotYet = (medId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setNudgeMedId(medId);
  };

  const handleAlrightTookIt = async () => {
    if (nudgeMedId) {
      const med = medications.find((m) => m.id === nudgeMedId);
      const doseCount = getDoseCount(med);
      for (let i = 0; i < doseCount; i++) {
        const log = medLogs.find((l) => l.medicationId === nudgeMedId && (l.doseIndex ?? 0) === i);
        if (!log?.taken) {
          await medicationLogStorage.toggle(nudgeMedId, today, i);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNudgeMedId(null);
      loadData();
    }
  };

  const isDoseTaken = (medId: string, doseIdx: number) =>
    medLogs.find((l) => l.medicationId === medId && (l.doseIndex ?? 0) === doseIdx)?.taken || false;

  const isSickMode = settings.sickMode;

  const getDoseCount = (med?: Medication | null) => {
    if (!med) return 1;
    if (Array.isArray(med.doses) && med.doses.length > 0) return med.doses.length;
    return (med as { doses?: number }).doses ?? 1;
  };

  const getMedTags = (med: Medication): string[] => {
    if (Array.isArray(med.doses) && med.doses.length > 0) return med.doses.map((d) => d.timeOfDay);
    return Array.isArray(med.timeTag) ? med.timeTag : [med.timeTag ?? "Morning"];
  };
  const grouped = TIME_TAGS.map((tag) => ({
    tag, meds: medications.filter((m) => getMedTags(m).includes(tag) && m.active),
  })).filter((g) => g.meds.length > 0);

  const totalDoses = medications.filter((m) => m.active).reduce((sum, m) => sum + getDoseCount(m), 0);
  const takenDoses = medications.filter((m) => m.active).reduce((sum, m) => {
    const dc = getDoseCount(m);
    let taken = 0;
    for (let i = 0; i < dc; i++) {
      if (isDoseTaken(m.id, i)) taken++;
    }
    return sum + taken;
  }, 0);

  const SICK_SYMPTOMS = ["Nausea", "Vomiting", "Diarrhea", "Dizziness", "Fatigue", "Headache", "Chills", "Body aches", "Fever", "Loss of appetite"];
  const HYDRATION_GOAL = 2000;

  const updateSickData = async (updates: Partial<SickModeData>) => {
    const current = sickData || await sickModeStorage.get();
    const updated = { ...current, ...updates };
    await sickModeStorage.save(updated);
    setSickData(updated);
  };

  const addHydration = async (ml: number) => {
    const current = sickData?.hydrationMl || 0;
    await updateSickData({ hydrationMl: current + ml });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleFoodItem = async (key: "lightMeal" | "saltySnack" | "liquidCalories") => {
    const current = sickData?.foodChecklist || { lightMeal: false, saltySnack: false, liquidCalories: false };
    await updateSickData({ foodChecklist: { ...current, [key]: !current[key] } });
    Haptics.selectionAsync();
  };

  const toggleRestItem = async (key: "lying" | "napping" | "screenBreak") => {
    const current = sickData?.restChecklist || { lying: false, napping: false, screenBreak: false };
    await updateSickData({ restChecklist: { ...current, [key]: !current[key] } });
    Haptics.selectionAsync();
  };

  const toggleSickSymptom = async (symptom: string) => {
    const current = sickData?.symptoms || [];
    const updated = current.includes(symptom) ? current.filter((s) => s !== symptom) : [...current, symptom];
    await updateSickData({ symptoms: updated });
    Haptics.selectionAsync();
  };

  const addTemperature = async () => {
    const val = parseFloat(tempInput);
    if (isNaN(val)) return;
    const current = sickData?.temperatures || [];
    const now = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    await updateSickData({ temperatures: [...current, { time: now, value: val }] });
    setTempInput("");
    setShowTempModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (val >= 100 && !settings.sickMode) {
      Alert.alert("High Temperature", "Your temperature is ≥ 100°F. Consider activating Sick Mode in Settings.");
    }
  };

  const getReadAloudText = useCallback(() => {
    const parts: string[] = [];
    parts.push(`${takenDoses} of ${totalDoses} doses taken today.`);
    medications.filter((m) => m.active).forEach((med) => {
      const dc = getDoseCount(med);
      let taken = 0;
      for (let i = 0; i < dc; i++) {
        if (isDoseTaken(med.id, i)) taken++;
      }
      const status = taken === dc ? "taken" : `${taken} of ${dc} taken`;
      const doseDesc = Array.isArray(med.doses) && med.doses.length > 0
        ? med.doses.map((d) => `${d.amount} ${d.unit} ${d.timeOfDay}`).join(", ")
        : `${(med as { dosage?: string }).dosage ?? ""} ${(med as { unit?: string }).unit ?? ""}`.trim() || "—";
      parts.push(`${med.name}, ${doseDesc}, ${status}.`);
    });
    return parts.join(" ");
  }, [medications, medLogs, takenDoses, totalDoses]);

  const doseLabels = (med: Medication): string[] => {
    if (Array.isArray(med.doses) && med.doses.length > 0) {
      return med.doses.map((d) => (d.amount && d.unit ? `${d.amount} ${d.unit} — ${d.timeOfDay}` : d.timeOfDay));
    }
    const count = getDoseCount(med);
    const tags = getMedTags(med);
    if (Array.isArray(tags) && tags.length === count) return tags;
    return Array.from({ length: count }, (_, i) => `Dose ${i + 1}`);
  };

  const topPad = isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16);

  return (
    <View style={[styles.container, isSickMode && { backgroundColor: sickPalette.background }]}>
      <View style={[styles.headerSticky, { paddingTop: topPad }]}>
        {isSickMode && (
          <View style={[styles.sickBanner, { backgroundColor: sickPalette.accentLight, borderColor: sickPalette.accentBorder }]}>
            <View style={styles.sickBannerInner}>
              <Ionicons name="warning" size={16} color={sickPalette.accent} />
              <Text style={[styles.sickBannerText, { color: sickPalette.accent }]}>Recovery protocol active</Text>
            </View>
          </View>
        )}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, isSickMode && { color: sickPalette.accent }]}>Medications</Text>
            <Text style={[styles.subtitle, isSickMode && { color: sickPalette.text }]}>{takenDoses}/{totalDoses} doses taken today</Text>
          </View>
        </View>
        {totalDoses > 0 && (
          <View style={[styles.progressBar, isSickMode && { backgroundColor: sickPalette.progress }]}>
            <View style={[styles.progressFill, { width: `${(takenDoses / totalDoses) * 100}%` }, isSickMode && { backgroundColor: sickPalette.accent }]} />
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, {
          paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
        }]}
        showsVerticalScrollIndicator={false}
      >
        {grouped.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="medical-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No medications yet</Text>
            <Text style={styles.emptyDesc}>Tap the + button to add your first medication.</Text>
          </View>
        ) : (
          grouped.map(({ tag, meds }) => (
          <View key={tag} style={{ marginBottom: 20 }}>
            <View style={[styles.tagBadge, { backgroundColor: TAG_COLORS[tag]?.bg ?? C.surfaceElevated }]}>
              <Ionicons name={(TAG_COLORS[tag]?.icon ?? "ellipse-outline") as any} size={12} color={TAG_COLORS[tag]?.text ?? C.textSecondary} />
              <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text ?? C.textSecondary }]}>{tag}</Text>
            </View>
            {meds.map((med) => {
              const indicesForTag: number[] = [];
              if (Array.isArray(med.doses) && med.doses.length > 0) {
                med.doses.forEach((d, idx) => {
                  if (d.timeOfDay === tag) indicesForTag.push(idx);
                });
              } else {
                const tt = (med as { timeTag?: string | string[] }).timeTag;
                if (Array.isArray(tt)) {
                  tt.forEach((t, idx) => {
                    if (t === tag) indicesForTag.push(idx);
                  });
                } else if (typeof tt === "string" && tt === tag) {
                  indicesForTag.push(0);
                }
              }

              if (indicesForTag.length === 0) return null;

              const doseCountForTag = indicesForTag.length;
              const takenForTag = indicesForTag.filter((i) => isDoseTaken(med.id, i)).length;
              const allTaken = takenForTag === doseCountForTag;
              const labels = doseLabels(med);
              const emoji = getAutoEmoji(med);
              const totalDosesMed = getDoseCount(med);
              const takenTotalMed = Array.from({ length: totalDosesMed }, (_, i) => isDoseTaken(med.id, i)).filter(Boolean).length;
              const showRefill = med.pillsRemaining != null;

              return (
                <Pressable
                  key={med.id}
                  style={[
                    styles.medCard,
                    allTaken && styles.medCardTaken,
                  ]}
                  onPress={() => openEditModal(med)}
                >
                  <View style={styles.medInfo}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={{ fontSize: 18 }}>{emoji}</Text>
                        <Text style={[styles.medName, allTaken && styles.medNameTaken]}>{med.name}</Text>
                      </View>
                      {Array.isArray(med.doses) && med.doses.length > 0 ? (
                        med.doses
                          .map((d, i) => ({ d, i }))
                          .filter(({ i }) => indicesForTag.includes(i))
                          .map(({ d, i }) => (
                            <Text key={d.id || i} style={styles.medDose}>
                              {d.amount && d.unit ? `${d.amount} ${d.unit} — ${d.timeOfDay}` : d.timeOfDay}
                            </Text>
                          ))
                      ) : (med as { dosage?: string }).dosage ? (
                        <Text style={styles.medDose}>
                          {(med as { dosage?: string }).dosage}{(med as { unit?: string }).unit ? ` ${(med as { unit?: string }).unit}` : ""}
                          {med.route ? ` · ${med.route}` : ""}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                        {!!med.frequency && <Text style={styles.medFreq}>{med.frequency}</Text>}
                        {totalDosesMed > 0 && (
                          <Text style={[styles.medFreq, { marginTop: 0, marginLeft: 0 }]}>
                            ({takenTotalMed}/{totalDosesMed} doses today)
                          </Text>
                        )}
                      </View>
                    </View>
                    <Pressable onPress={() => handleDelete(med)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove ${med.name}`}>
                      <Ionicons name="trash-outline" size={16} color={C.textTertiary} />
                    </Pressable>
                  </View>

                  {showRefill && (
                    <View style={styles.refillRow}>
                      <Ionicons name="alert-circle-outline" size={14} color={C.textTertiary} />
                      <Text style={[styles.refillText, (med.pillsRemaining ?? 0) <= 5 && styles.refillTextWarning]}>
                        Refill reminder · {(med.pillsRemaining ?? 0)} pills remaining
                      </Text>
                    </View>
                  )}

                  {doseCountForTag === 1 ? (
                    allTaken ? (
                      <Pressable
                        style={styles.takenBanner}
                        onPress={() => handleDoseToggle(med.id, indicesForTag[0])}
                        accessibilityRole="button"
                        accessibilityLabel={`${med.name} taken, tap to undo`}
                      >
                        <Ionicons name="checkmark-circle" size={18} color={C.green} />
                        <Text style={styles.takenText}>Taken</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.actionRow}>
                        <Pressable
                          style={styles.yesBtn}
                          onPress={() => handleDoseToggle(med.id, indicesForTag[0])}
                          testID={`taken-${med.name}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Mark ${med.name} as taken`}
                        >
                          <Ionicons name="checkmark" size={16} color="#fff" />
                          <Text style={styles.yesBtnText}>Yes, took it</Text>
                        </Pressable>
                        <Pressable style={styles.notYetBtn} onPress={() => handleNotYet(med.id)} testID={`notyet-${med.name}`} accessibilityRole="button" accessibilityLabel={`Skip ${med.name} for now`}>
                          <Text style={styles.notYetText}>Not yet</Text>
                        </Pressable>
                      </View>
                    )
                  ) : (
                    <View style={styles.dosesContainer}>
                      {indicesForTag.map((doseIdx) => {
                        const taken = isDoseTaken(med.id, doseIdx);
                        return (
                          <Pressable
                            key={doseIdx}
                            style={[styles.doseRow, taken && styles.doseRowTaken]}
                            onPress={() => handleDoseToggle(med.id, doseIdx)}
                            accessibilityRole="button"
                            accessibilityLabel={`${med.name} ${labels[doseIdx]}, ${taken ? "taken" : "missed"}`}
                          >
                            <Ionicons
                              name={taken ? "checkmark-circle" : "close-circle-outline"}
                              size={20}
                              color={taken ? C.green : C.textTertiary}
                            />
                            <Text style={[styles.doseLabel, taken && { color: C.green }]}>{labels[doseIdx]}</Text>
                            <Text style={{ fontSize: 11, fontWeight: "600" as const, color: taken ? C.green : C.textTertiary }}>
                              {taken ? "Taken" : "Missed"}
                            </Text>
                            {!taken && (
                              <Pressable style={styles.doseNotYet} onPress={() => handleNotYet(med.id)}>
                                <Text style={styles.doseNotYetText}>skip</Text>
                              </Pressable>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )))}

        {medications.length > 0 && (
          <View style={styles.safetyNote}>
            <Ionicons name="information-circle-outline" size={14} color={C.textTertiary} />
            <Text style={styles.safetyNoteText}>
              This information should match your doctor's instructions. This app does not prescribe medications.
            </Text>
          </View>
        )}

        {isSickMode && sickData && (
          <View style={styles.protocolSection}>
            <View style={styles.protocolHeader}>
              <Ionicons name="shield" size={20} color={C.red} />
              <Text style={styles.protocolTitle}>Sick Mode Protocol</Text>
            </View>

            <View style={styles.protocolCard}>
              <View style={styles.protocolCardHeader}>
                <Text style={{ fontSize: 16 }}>💧</Text>
                <Text style={styles.protocolCardTitle}>Hydration</Text>
                <Text style={styles.protocolMeta}>{sickData.hydrationMl} / {HYDRATION_GOAL} mL</Text>
              </View>
              <View style={styles.hydrationBar}>
                <View style={[styles.hydrationFill, { width: `${Math.min(100, (sickData.hydrationMl / HYDRATION_GOAL) * 100)}%` }]} />
              </View>
              <View style={styles.hydrationBtns}>
                {[250, 500].map((ml) => (
                  <Pressable key={ml} style={styles.hydrationBtn} onPress={() => addHydration(ml)} accessibilityRole="button" accessibilityLabel={`Add ${ml} millilitres of water`}>
                    <Ionicons name="add" size={14} color={C.tint} />
                    <Text style={styles.hydrationBtnText}>{ml} mL</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.protocolCard}>
              <View style={styles.protocolCardHeader}>
                <Text style={{ fontSize: 16 }}>🍽️</Text>
                <Text style={styles.protocolCardTitle}>Food Checklist</Text>
              </View>
              {([
                { key: "lightMeal" as const, label: "Light meal", icon: "restaurant-outline" },
                { key: "saltySnack" as const, label: "Salty snack", icon: "nutrition-outline" },
                { key: "liquidCalories" as const, label: "Liquid calories", icon: "water-outline" },
              ]).map(({ key, label, icon }) => (
                <Pressable key={key} style={styles.checkRow} onPress={() => toggleFoodItem(key)} accessibilityRole="checkbox" accessibilityState={{ checked: sickData.foodChecklist[key] }} accessibilityLabel={label}>
                  <Ionicons
                    name={sickData.foodChecklist[key] ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={sickData.foodChecklist[key] ? C.green : C.textTertiary}
                  />
                  <Ionicons name={icon as any} size={16} color={C.textSecondary} />
                  <Text style={[styles.checkLabel, sickData.foodChecklist[key] && { color: C.green }]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.protocolCard}>
              <View style={styles.protocolCardHeader}>
                <Text style={{ fontSize: 16 }}>🌡️</Text>
                <Text style={styles.protocolCardTitle}>Temperature</Text>
                <Pressable style={styles.tempAddBtn} onPress={() => setShowTempModal(true)} accessibilityRole="button" accessibilityLabel="Log temperature">
                  <Ionicons name="add" size={16} color={C.tint} />
                </Pressable>
              </View>
              {(sickData.temperatures || []).length === 0 && (
                <Text style={styles.protocolEmpty}>No readings yet. Tap + to log temperature.</Text>
              )}
              {(sickData.temperatures || []).slice(-5).reverse().map((t, i) => (
                <View key={i} style={styles.tempRow}>
                  <Text style={styles.tempTime}>{t.time}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="thermometer-outline" size={14} color={t.value >= 102 ? C.red : t.value >= 100 ? C.orange : C.green} />
                    <Text style={[styles.tempValue, t.value >= 100 && { color: t.value >= 102 ? C.red : C.orange }]}>
                      {t.value}°F
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "500" as const, color: t.value >= 102 ? C.red : t.value >= 100 ? C.orange : C.green }}>
                      {t.value >= 102 ? "High Fever" : t.value >= 100 ? "Fever" : "Normal"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.protocolCard}>
              <View style={styles.protocolCardHeader}>
                <Text style={{ fontSize: 16 }}>😴</Text>
                <Text style={styles.protocolCardTitle}>Rest Checklist</Text>
              </View>
              {([
                { key: "lying" as const, label: "Lying down / resting" },
                { key: "napping" as const, label: "Took a nap" },
                { key: "screenBreak" as const, label: "Screen break taken" },
              ]).map(({ key, label }) => (
                <Pressable key={key} style={styles.checkRow} onPress={() => toggleRestItem(key)}>
                  <Ionicons
                    name={sickData.restChecklist[key] ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={sickData.restChecklist[key] ? C.green : C.textTertiary}
                  />
                  <Text style={[styles.checkLabel, sickData.restChecklist[key] && { color: C.green }]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.protocolCard}>
              <View style={styles.protocolCardHeader}>
                <Text style={{ fontSize: 16 }}>🩺</Text>
                <Text style={styles.protocolCardTitle}>Quick Symptoms</Text>
              </View>
              <View style={styles.symptomGrid}>
                {SICK_SYMPTOMS.map((s) => {
                  const active = sickData.symptoms?.includes(s);
                  return (
                    <Pressable key={s} style={[styles.symptomChip, active && styles.symptomChipActive]} onPress={() => toggleSickSymptom(s)}>
                      <Text style={[styles.symptomChipText, active && { color: C.red }]}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <Pressable
        testID="add-medication"
        style={({ pressed }) => [
          styles.fab,
          {
            right: isWide ? 24 : 20,
            bottom: Platform.OS === "web" ? 100 : insets.bottom + 80,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
        onPress={openAddModal}
        accessibilityRole="button"
        accessibilityLabel="Add medication"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <Modal visible={showTempModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowTempModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Log Temperature</Text>
            <Text style={styles.label}>Temperature (°F)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 98.6"
              placeholderTextColor={C.textTertiary}
              value={tempInput}
              onChangeText={setTempInput}
              keyboardType="decimal-pad"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowTempModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, !tempInput.trim() && { opacity: 0.5 }]} onPress={addTemperature} disabled={!tempInput.trim()}>
                <Text style={styles.confirmText}>Log</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showMedListModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => { setShowMedListModal(false); setShowMedListDoctorPicker(false); setShowMedListDoseTimePickerIndex(null); setEditingMedListItem(null); }}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingMedListItem ? "Edit medication" : "Add to Medications List"}</Text>
              <Text style={styles.label}>Medication name</Text>
              <TextInput style={styles.input} placeholder="e.g. Metformin" placeholderTextColor={C.textTertiary} value={formMedListName} onChangeText={setFormMedListName} />
              <Text style={styles.label}>Doses</Text>
              {formMedListDoses.map((dose, idx) => (
                <View key={idx} style={styles.doseRowWrap}>
                  <TextInput
                    style={[styles.input, styles.doseAmountInput]}
                    placeholder="e.g. 15 mg"
                    placeholderTextColor={C.textTertiary}
                    value={dose.dosage}
                    onChangeText={(t) => setFormMedListDoses((prev) => prev.map((d, i) => (i === idx ? { ...d, dosage: t } : d)))}
                  />
                  <View style={styles.doseTimePickerWrap}>
                    <Pressable
                      style={styles.doseTimeBtn}
                      onPress={() => setShowMedListDoseTimePickerIndex((v) => (v === idx ? null : idx))}
                    >
                      <Text style={styles.doseTimeBtnText} numberOfLines={1}>{dose.time}</Text>
                      <Ionicons name="chevron-down" size={14} color={C.textSecondary} />
                    </Pressable>
                    {showMedListDoseTimePickerIndex === idx && (
                      <View style={styles.doseTimeDropdown}>
                        {MED_LIST_DOSE_TIMES.map((t) => (
                          <Pressable
                            key={t}
                            style={[styles.dropdownRow, dose.time === t && styles.dropdownRowSelected]}
                            onPress={() => {
                              setFormMedListDoses((prev) => prev.map((d, i) => (i === idx ? { ...d, time: t } : d)));
                              setShowMedListDoseTimePickerIndex(null);
                              Haptics.selectionAsync();
                            }}
                          >
                            <Text style={styles.dropdownText}>{t}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                  {formMedListDoses.length > 1 ? (
                    <Pressable
                      style={styles.doseRemoveBtn}
                      onPress={() => setFormMedListDoses((prev) => prev.filter((_, i) => i !== idx))}
                      accessibilityRole="button"
                      accessibilityLabel="Remove dose"
                    >
                      <Ionicons name="close-circle" size={22} color={C.textTertiary} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
              <Pressable style={styles.addDoseBtn} onPress={() => setFormMedListDoses((prev) => [...prev, { dosage: "", time: "Morning" }])} accessibilityRole="button" accessibilityLabel="Add dose">
                <Ionicons name="add" size={18} color={C.tint} />
                <Text style={styles.addDoseBtnText}>Add Dose</Text>
              </Pressable>
              <Text style={styles.label}>Prescribing doctor</Text>
              <Pressable style={styles.input} onPress={() => setShowMedListDoctorPicker((v) => !v)}>
                <Text style={[styles.pickerPlaceholder, formMedListPrescribingDoctor && { color: C.text }]}>{formMedListPrescribingDoctor || (doctors.length === 0 ? "No doctors found. Add doctors in Settings." : "Select doctor")}</Text>
                <Ionicons name="chevron-down" size={18} color={C.textTertiary} style={{ position: "absolute", right: 12, top: 14 }} />
              </Pressable>
              {showMedListDoctorPicker && doctors.length > 0 && (
                <View style={styles.dropdown}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
                    {doctors.map((d) => (
                      <Pressable key={d.id} style={[styles.dropdownRow, formMedListPrescribingDoctor === d.name && styles.dropdownRowSelected]} onPress={() => { setFormMedListPrescribingDoctor(d.name); setShowMedListDoctorPicker(false); Haptics.selectionAsync(); }}>
                        <Text style={styles.dropdownText}>{d.name}</Text>
                        {d.specialty ? <Text style={styles.dropdownSub}>{d.specialty}</Text> : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              <Text style={styles.label}>Pharmacy name</Text>
              <TextInput style={styles.input} placeholder="e.g. CVS Pharmacy" placeholderTextColor={C.textTertiary} value={formMedListPharmacyName} onChangeText={setFormMedListPharmacyName} />
              <Text style={styles.label}>Pharmacy phone</Text>
              <TextInput style={styles.input} placeholder="e.g. 617-555-1234" placeholderTextColor={C.textTertiary} value={formMedListPharmacyPhone} onChangeText={setFormMedListPharmacyPhone} keyboardType="phone-pad" />
              <Text style={styles.label}>Pharmacy address</Text>
              <TextInput style={styles.input} placeholder="e.g. 123 Tremont St, Boston MA" placeholderTextColor={C.textTertiary} value={formMedListPharmacyAddress} onChangeText={setFormMedListPharmacyAddress} />
              <Text style={styles.label}>Refills remaining</Text>
              <TextInput style={styles.input} placeholder="e.g. 3" placeholderTextColor={C.textTertiary} value={formMedListRefills} onChangeText={setFormMedListRefills} keyboardType="number-pad" />
              <Text style={styles.label}>Duration (optional)</Text>
              <View style={styles.durationRow}>
                <TextInput style={[styles.input, styles.durationInput]} placeholder="e.g. 7" placeholderTextColor={C.textTertiary} value={formMedListDuration} onChangeText={setFormMedListDuration} keyboardType="number-pad" />
                <View style={styles.durationUnitRow}>
                  {(["Days", "Weeks", "Months"] as const).map((u) => (
                    <Pressable key={u} style={[styles.durationUnitBtn, formMedListDurationUnit === u && styles.durationUnitBtnActive]} onPress={() => { setFormMedListDurationUnit(formMedListDurationUnit === u ? "" : u); Haptics.selectionAsync(); }}>
                      <Text style={[styles.durationUnitText, formMedListDurationUnit === u && { color: "#fff" }]}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => { setShowMedListModal(false); setShowMedListDoctorPicker(false); setShowMedListDoseTimePickerIndex(null); setEditingMedListItem(null); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                <Pressable style={[styles.confirmBtn, !formMedListName.trim() && { opacity: 0.5 }]} onPress={handleSaveMedListItem} disabled={!formMedListName.trim()}>
                  <Text style={styles.confirmText}>{editingMedListItem ? "Update" : "Add"}</Text>
                </Pressable>
              </View>
              {editingMedListItem ? (
                <Pressable style={styles.deleteMedListBtn} onPress={handleDeleteMedListItem} accessibilityRole="button" accessibilityLabel="Delete this medication from list">
                  <Ionicons name="trash-outline" size={18} color={C.red} />
                  <Text style={styles.deleteMedListBtnText}>Delete</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => { setShowModal(false); setShowCurrentMedNamePicker(false); setShowDoseTimePickerIndex(null); }}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingMed ? "Edit Medication" : "Add Medication"}</Text>

              <Text style={styles.label}>Emoji</Text>
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map((e) => (
                  <Pressable key={e} style={[styles.emojiOpt, formEmoji === e && styles.emojiOptActive]} onPress={() => { setFormEmoji(e); Haptics.selectionAsync(); }}>
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Name</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="e.g. Hydrocortisone"
                  placeholderTextColor={C.textTertiary}
                  value={formName}
                  onChangeText={(t) => { setFormName(t); setShowCurrentMedNamePicker(false); }}
                  autoCorrect={false}
                />
                {medListItems.length > 0 && (
                  <Pressable onPress={() => setShowCurrentMedNamePicker((v) => !v)} hitSlop={8} style={{ paddingLeft: 8 }}>
                    <Ionicons name="chevron-down" size={20} color={C.textTertiary} />
                  </Pressable>
                )}
              </View>
              {showCurrentMedNamePicker && medListItems.length > 0 && (
                <View style={styles.dropdown}>
                  {(editingMed && !medListItems.some((m) => m.name === editingMed.name) ? [editingMed.name, ...medListItems.map((m) => m.name)] : medListItems.map((m) => m.name))
                    .filter((name, i, arr) => arr.indexOf(name) === i)
                    .map((name) => {
                      const med = medListItems.find((m) => m.name === name);
                      const listDoses = med?.doses?.length ? med.doses : (med ? [{ dosage: (med as unknown as { dosage?: string }).dosage ?? "", time: "Morning" as MedListDoseTime }] : []);
                      return (
                        <Pressable
                          key={name}
                          style={[styles.dropdownRow, formName === name && styles.dropdownRowSelected]}
                          onPress={() => {
                            setFormName(name);
                            setShowCurrentMedNamePicker(false);
                            const newDoses = listDoses.map((d) => {
                              const parts = d.dosage.trim().split(/\s+/);
                              return { id: Crypto.randomUUID(), amount: parts[0] ?? "", unit: parts.slice(1).join(" ") || "mg", timeOfDay: d.time, optionalNotes: "" };
                            });
                            setFormDosesArray(newDoses.length > 0 ? newDoses : [{ id: Crypto.randomUUID(), amount: "", unit: "mg", timeOfDay: "Morning", optionalNotes: "" }]);
                            Haptics.selectionAsync();
                          }}
                        >
                          <Text style={styles.dropdownText}>{name}</Text>
                        </Pressable>
                      );
                    })}
                </View>
              )}
              <Text style={styles.label}>Doses</Text>
              <Text style={[styles.medFreq, { marginBottom: 8 }]}>Each dose is tracked independently for reminders and logging.</Text>
              {formDosesArray.map((dose, idx) => (
                <View key={dose.id || idx} style={styles.doseCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Text style={styles.doseCardTitle}>Dose {idx + 1}</Text>
                    {formDosesArray.length > 1 && (
                      <Pressable style={styles.doseRemoveBtn} onPress={() => setFormDosesArray((prev) => prev.filter((_, i) => i !== idx))} accessibilityRole="button" accessibilityLabel="Remove dose">
                        <Ionicons name="close-circle" size={22} color={C.textTertiary} />
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.doseRowWrap}>
                    <TextInput
                      style={[styles.input, styles.doseAmountInput]}
                      placeholder="Amount (e.g. 15)"
                      placeholderTextColor={C.textTertiary}
                      value={dose.amount}
                      onChangeText={(t) => setFormDosesArray((prev) => prev.map((d, i) => (i === idx ? { ...d, amount: t } : d)))}
                    />
                    <TextInput
                      style={[styles.input, styles.doseUnitInput]}
                      placeholder="mg"
                      placeholderTextColor={C.textTertiary}
                      value={dose.unit}
                      onChangeText={(t) => setFormDosesArray((prev) => prev.map((d, i) => (i === idx ? { ...d, unit: t } : d)))}
                    />
                  </View>
                  <View style={styles.doseTimePickerWrap}>
                    <Pressable
                      style={styles.doseTimeBtn}
                      onPress={() => setShowDoseTimePickerIndex((v) => (v === idx ? null : idx))}
                    >
                      <Text style={styles.doseTimeBtnText} numberOfLines={1}>{dose.timeOfDay}</Text>
                      <Ionicons name="chevron-down" size={14} color={C.textSecondary} />
                    </Pressable>
                    {showDoseTimePickerIndex === idx && (
                      <View style={styles.doseTimeDropdown}>
                        {TIME_TAGS.filter((tag) => settings.ramadanMode || (tag !== "Before Fajr" && tag !== "After Iftar")).map((tag) => (
                          <Pressable
                            key={tag}
                            style={[styles.dropdownRow, dose.timeOfDay === tag && styles.dropdownRowSelected]}
                            onPress={() => {
                              setFormDosesArray((prev) => prev.map((d, i) => (i === idx ? { ...d, timeOfDay: tag } : d)));
                              setShowDoseTimePickerIndex(null);
                              Haptics.selectionAsync();
                            }}
                          >
                            <Text style={styles.dropdownText}>{tag}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                  <TextInput
                    style={[styles.input, { marginTop: 6 }]}
                    placeholder="Optional notes"
                    placeholderTextColor={C.textTertiary}
                    value={dose.optionalNotes}
                    onChangeText={(t) => setFormDosesArray((prev) => prev.map((d, i) => (i === idx ? { ...d, optionalNotes: t } : d)))}
                  />
                </View>
              ))}
              <Pressable style={styles.addDoseBtn} onPress={() => setFormDosesArray((prev) => [...prev, { id: Crypto.randomUUID(), amount: "", unit: "mg", timeOfDay: "Morning", reminderTime: "08:00", optionalNotes: "" }])} accessibilityRole="button" accessibilityLabel="Add dose">
                <Ionicons name="add" size={18} color={C.tint} />
                <Text style={styles.addDoseBtnText}>+ Add Dose</Text>
              </Pressable>

              <Text style={styles.label}>Route</Text>
              <TextInput style={styles.input} placeholder="e.g. tablet, injection, inhaler" placeholderTextColor={C.textTertiary} value={formRoute} onChangeText={setFormRoute} />

              <Text style={styles.label}>Frequency</Text>
              <TextInput style={styles.input} placeholder="e.g. Once daily" placeholderTextColor={C.textTertiary} value={formFreq} onChangeText={setFormFreq} />

              <Text style={[styles.label, { marginTop: 16 }]}>Reminder Times</Text>
              <Text style={[styles.label, { fontSize: 12, color: C.textTertiary, marginTop: 2, marginBottom: 8 }]}>Set when Synapse should remind you for each dose. Used for daily notifications.</Text>
              {formDosesArray.map((dose, idx) => (
                <View key={dose.id || idx} style={{ marginBottom: 12 }}>
                  <Text style={[styles.label, { fontSize: 13, marginBottom: 4 }]}>Dose {idx + 1} – {dose.timeOfDay}</Text>
                  <Pressable
                    style={[styles.input, { justifyContent: "center" }]}
                    onPress={() => setShowReminderTimePickerIndex(idx)}
                  >
                    <Text style={{ color: C.textPrimary, fontSize: 16 }}>{formatReminderTimeDisplay(dose.reminderTime)}</Text>
                  </Pressable>
                </View>
              ))}

              <Text style={[styles.label, { marginTop: 12 }]}>Refill reminder (optional)</Text>
              <Text style={[styles.label, { fontSize: 11, color: C.textTertiary, marginBottom: 6 }]}>When pills remaining is 5 or less, you'll get a refill reminder.</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { fontSize: 12 }]}>Total pills</Text>
                  <TextInput style={styles.input} placeholder="e.g. 30" placeholderTextColor={C.textTertiary} value={formTotalPills} onChangeText={setFormTotalPills} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { fontSize: 12 }]}>Pills remaining</Text>
                  <TextInput style={styles.input} placeholder="e.g. 7" placeholderTextColor={C.textTertiary} value={formPillsRemaining} onChangeText={setFormPillsRemaining} keyboardType="number-pad" />
                </View>
              </View>

              <View style={styles.stressDoseSection}>
                <Text style={[styles.label, { fontSize: 13, fontWeight: "600" as const, marginBottom: 10 }]}>Sick Day / Stress Dose</Text>
                <Pressable
                  style={styles.stressDoseToggle}
                  onPress={() => { setFormHasStressDose(!formHasStressDose); Haptics.selectionAsync(); }}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: formHasStressDose }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stressDoseToggleText}>Do you take a different dose of this medication when you are sick?</Text>
                  </View>
                  <View style={[styles.toggleTrack, formHasStressDose && styles.toggleTrackActive]}>
                    <View style={[styles.toggleThumb, formHasStressDose && styles.toggleThumbActive]} />
                  </View>
                </Pressable>

                {formHasStressDose && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.label}>Stress dose amount</Text>
                    <TextInput style={styles.input} placeholder="e.g. 15 mg" placeholderTextColor={C.textTertiary} value={formStressDoseAmount} onChangeText={setFormStressDoseAmount} />

                    <Text style={styles.label}>How often?</Text>
                    <TextInput style={styles.input} placeholder="e.g. every 6 hours" placeholderTextColor={C.textTertiary} value={formStressDoseFrequency} onChangeText={setFormStressDoseFrequency} />

                    <Text style={styles.label}>For how many days? (optional)</Text>
                    <TextInput style={styles.input} placeholder="e.g. 3" placeholderTextColor={C.textTertiary} value={formStressDoseDurationDays} onChangeText={setFormStressDoseDurationDays} keyboardType="number-pad" />

                    <Text style={styles.label}>Special instructions (optional)</Text>
                    <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]} placeholder="e.g. take with food, call doctor if vomiting" placeholderTextColor={C.textTertiary} value={formStressDoseInstructions} onChangeText={setFormStressDoseInstructions} multiline />
                  </View>
                )}
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => { setShowModal(false); setShowCurrentMedNamePicker(false); setShowReminderTimePickerIndex(null); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                <Pressable
                  style={[styles.confirmBtn, !canSaveMedication && { opacity: 0.5 }]}
                  onPress={handleSave}
                  disabled={!canSaveMedication}
                >
                  <Text style={styles.confirmText}>{editingMed ? "Save" : "Add"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {showReminderTimePickerIndex !== null && formDosesArray[showReminderTimePickerIndex] && (
        <Modal visible transparent animationType="slide">
          <Pressable style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setShowReminderTimePickerIndex(null)}>
            <Pressable style={{ backgroundColor: C.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 32 }} onPress={(e) => e.stopPropagation()}>
              <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                <Text style={[styles.label, { marginBottom: 8 }]}>
                  Reminder Time{formDosesArray.length > 1 ? ` – Dose ${showReminderTimePickerIndex + 1} (${formDosesArray[showReminderTimePickerIndex].timeOfDay})` : ""}
                </Text>
                <DateTimePicker
                  value={reminderTimeToDate(formDosesArray[showReminderTimePickerIndex].reminderTime)}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, date) => {
                    if (date) {
                      setFormDosesArray((prev) => prev.map((d, i) => (i === showReminderTimePickerIndex ? { ...d, reminderTime: dateToReminderTime(date) } : d)));
                    }
                    if (Platform.OS === "android") setShowReminderTimePickerIndex(null);
                  }}
                />
                {Platform.OS === "ios" && (
                  <Pressable style={[styles.confirmBtn, { marginTop: 12 }]} onPress={() => setShowReminderTimePickerIndex(null)}>
                    <Text style={styles.confirmText}>Done</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <Modal visible={!!nudgeMedId} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.nudgeCard}>
            <Text style={styles.nudgeEmoji}>😤</Text>
            <Text style={styles.nudgeText}>What, you expecting an invite from Amma?</Text>
            <Pressable style={styles.nudgeBtn} testID="alright-took-it" onPress={handleAlrightTookIt}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.nudgeBtnText}>alright, alright, took it</Text>
            </Pressable>
            <Pressable style={styles.nudgeDismiss} onPress={() => setNudgeMedId(null)}>
              <Text style={styles.nudgeDismissText}>I really haven't yet</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ReadAloudButton getText={getReadAloudText} />
    </View>
  );
}

function makeStyles(C: Theme, S: SickModePalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 24 },
  headerSticky: { paddingHorizontal: 24 },
  sickBanner: { marginBottom: 16, borderRadius: 12, padding: 12, borderWidth: 1 },
  sickBannerInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  sickBannerText: { fontWeight: "600", fontSize: 13 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: C.surfaceElevated, marginBottom: 24 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: C.green },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontWeight: "600", fontSize: 17, color: C.text, marginTop: 8 },
  emptyDesc: { fontWeight: "400", fontSize: 13, color: C.textTertiary },
  fab: { position: "absolute", width: 56, height: 56, borderRadius: 28, backgroundColor: C.tint, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  refillRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10, marginLeft: 26 },
  refillText: { fontWeight: "500", fontSize: 12, color: C.textSecondary },
  refillTextWarning: { color: C.red },
  sectionPanel: { marginBottom: 0, paddingVertical: 16, paddingHorizontal: 4 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontWeight: "700", fontSize: 18, color: C.text },
  sectionAddBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  sectionDivider: { height: 1, backgroundColor: C.border, marginVertical: 8, marginHorizontal: 4 },
  medListEmpty: { fontWeight: "400", fontSize: 13, color: C.textTertiary, marginBottom: 12 },
  medListCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  medListCardName: { fontWeight: "600", fontSize: 15, color: C.text },
  medListCardDoseLine: { fontWeight: "400", fontSize: 13, color: C.textSecondary, marginTop: 2 },
  medListCardPrescriber: { fontWeight: "400", fontSize: 13, color: C.textSecondary, marginTop: 2 },
  medListCardRefills: { fontWeight: "500", fontSize: 12, color: C.tint, marginTop: 4 },
  medListCardRefillsWarning: { color: C.red },
  pickerPlaceholder: { fontWeight: "400", fontSize: 14, color: C.textTertiary },
  dropdown: { marginBottom: 14, maxHeight: 220, borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: "hidden", backgroundColor: C.surfaceElevated },
  dropdownScroll: { maxHeight: 220 },
  dropdownRow: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  dropdownRowSelected: { backgroundColor: C.tintLight },
  dropdownText: { fontWeight: "500", fontSize: 14, color: C.text },
  dropdownSub: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  deleteMedListBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, marginTop: 8, marginBottom: 12 },
  deleteMedListBtnText: { fontWeight: "600", fontSize: 15, color: C.red },
  durationRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  durationInput: { flex: 1, marginBottom: 0 },
  durationUnitRow: { flexDirection: "row", gap: 6 },
  durationUnitBtn: { paddingHorizontal: 10, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
  durationUnitBtnActive: { backgroundColor: C.tint, borderColor: C.tint },
  durationUnitText: { fontWeight: "600", fontSize: 12, color: C.textSecondary },
  doseCard: { marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
  doseCardTitle: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  doseRowWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  doseAmountInput: { flex: 2, marginBottom: 0 },
  doseUnitInput: { flex: 1, marginBottom: 0 },
  doseTimeBtn: { minWidth: 100, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
  doseTimeBtnText: { fontWeight: "500", fontSize: 13, color: C.text },
  doseTimePickerWrap: { position: "relative", minWidth: 100 },
  doseTimeDropdown: { position: "absolute", left: 0, right: 0, top: "100%", marginTop: 2, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border, borderRadius: 10, zIndex: 10, maxHeight: 160 },
  doseRemoveBtn: { padding: 4 },
  addDoseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, marginBottom: 14, borderWidth: 1, borderStyle: "dashed", borderColor: C.border, borderRadius: 10 },
  addDoseBtnText: { fontWeight: "600", fontSize: 13, color: C.tint },
  dosePickerBlock: { marginBottom: 14 },
  tagBadge: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  tagText: { fontWeight: "600", fontSize: 12 },
  medCard: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  medCardTaken: { borderColor: "rgba(48,209,88,0.25)", backgroundColor: "rgba(48,209,88,0.05)" },
  safetyNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingVertical: 12, paddingHorizontal: 4, marginBottom: 8 },
  safetyNoteText: { flex: 1, fontWeight: "400", fontSize: 11, color: C.textTertiary, lineHeight: 16 },
  stressDoseSection: { marginBottom: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border },
  stressDoseToggle: { flexDirection: "row", alignItems: "center", gap: 12 },
  stressDoseToggleText: { fontWeight: "400", fontSize: 13, color: C.text, lineHeight: 18 },
  toggleTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border, justifyContent: "center", paddingHorizontal: 2 },
  toggleTrackActive: { backgroundColor: C.tint, borderColor: C.tint },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  toggleThumbActive: { alignSelf: "flex-end" },
  medInfo: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  medName: { fontWeight: "600", fontSize: 15, color: C.text },
  medNameTaken: { color: C.textSecondary },
  medDose: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 4, marginLeft: 26 },
  medFreq: { fontWeight: "500", fontSize: 11, color: C.tint, marginTop: 3, marginLeft: 26 },
  actionRow: { flexDirection: "row", gap: 8 },
  yesBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.green },
  yesBtnText: { fontWeight: "600", fontSize: 13, color: "#fff" },
  notYetBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
  notYetText: { fontWeight: "600", fontSize: 13, color: C.textSecondary },
  takenBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(48,209,88,0.1)" },
  takenText: { fontWeight: "600", fontSize: 13, color: C.green },
  dosesContainer: { gap: 6 },
  doseRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.surfaceElevated },
  doseRowTaken: { backgroundColor: "rgba(48,209,88,0.08)" },
  doseLabel: { fontWeight: "500", fontSize: 13, color: C.text, flex: 1 },
  doseNotYet: { paddingHorizontal: 8, paddingVertical: 4 },
  doseNotYetText: { fontWeight: "500", fontSize: 11, color: C.textTertiary },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 400, maxHeight: "85%", borderWidth: 1, borderColor: C.border },
  modalTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 20 },
  label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  input: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  fieldRow: { flexDirection: "row", gap: 10 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  emojiOpt: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  emojiOptActive: { borderColor: C.tint, backgroundColor: C.tintLight },
  doseCountRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  doseCountBtn: { minWidth: 44, paddingHorizontal: 14, alignItems: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
  doseCountActive: { backgroundColor: C.tintLight, borderColor: C.tint },
  doseCountText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
  doseCountTextActive: { color: C.tint },
  tagPicker: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 20 },
  tagOpt: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated },
  tagOptText: { fontWeight: "500", fontSize: 12, color: C.textSecondary },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
  cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.tint, alignItems: "center" },
  confirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
  nudgeCard: { backgroundColor: C.surface, borderRadius: 20, padding: 28, width: "100%", maxWidth: 340, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  nudgeEmoji: { fontSize: 44, marginBottom: 16 },
  nudgeText: { fontWeight: "600", fontSize: 16, color: C.text, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  nudgeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.green, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: "100%", marginBottom: 10 },
  nudgeBtnText: { fontWeight: "600", fontSize: 14, color: "#fff" },
  nudgeDismiss: { paddingVertical: 10 },
  nudgeDismissText: { fontWeight: "500", fontSize: 13, color: C.textTertiary },
  protocolSection: { marginTop: 12, paddingTop: 20, borderTopWidth: 1, borderTopColor: S.accentBorder },
  protocolHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  protocolTitle: { fontWeight: "700", fontSize: 18, color: S.accent, letterSpacing: -0.3 },
  protocolCard: { backgroundColor: S.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: S.accentBorder },
  protocolCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  protocolCardTitle: { fontWeight: "600", fontSize: 14, color: S.text, flex: 1 },
  protocolMeta: { fontWeight: "500", fontSize: 12, color: C.textSecondary },
  protocolEmpty: { fontWeight: "400", fontSize: 13, color: C.textTertiary },
  hydrationBar: { height: 8, borderRadius: 4, backgroundColor: S.progress, marginBottom: 12, overflow: "hidden" },
  hydrationFill: { height: "100%", backgroundColor: S.accent, borderRadius: 4 },
  hydrationBtns: { flexDirection: "row", gap: 8 },
  hydrationBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: 10, backgroundColor: S.accentLight, borderWidth: 1, borderColor: S.accentBorder },
  hydrationBtnText: { fontWeight: "600", fontSize: 13, color: S.accent },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: S.accentBorder },
  checkLabel: { fontWeight: "500", fontSize: 14, color: S.text, flex: 1 },
  tempAddBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: S.accentLight, alignItems: "center", justifyContent: "center" },
  tempRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: S.accentBorder },
  tempTime: { fontWeight: "400", fontSize: 13, color: C.textSecondary },
  tempValue: { fontWeight: "600", fontSize: 14, color: S.text },
  symptomGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  symptomChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: S.accentBorder, backgroundColor: S.card },
  symptomChipActive: { borderColor: S.accent, backgroundColor: S.accentLight },
  symptomChipText: { fontWeight: "500", fontSize: 12, color: S.text },
  });
}

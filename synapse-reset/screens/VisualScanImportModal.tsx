import React, { useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TextInput from "@/components/DoneTextInput";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  appointmentStorage,
  imagingStorage,
  labWorkStorage,
  medicationStorage,
  type Appointment,
  type Imaging,
  type LabWork,
  type Medication,
} from "@/lib/storage";
import { syncWidgetSnapshot } from "@/lib/widget-sync";
import {
  parseAppointmentScan,
  parseImagingScan,
  parseLabScan,
  parseMedicationScan,
  recognizeTextFromImage,
  type VisualScanType,
} from "@/lib/visual-scan";
import { modalOverlay, modalSurface, modalSurfaceElevated } from "@/lib/modal-colors";

type Props = {
  visible: boolean;
  initialType?: VisualScanType;
  onClose: () => void;
  onSaved?: (kind: VisualScanType, id?: string) => void;
};

export default function VisualScanImportModal({ visible, initialType = "medication", onClose, onSaved }: Props) {
  const { colors: C } = useTheme();
  const styles = makeStyles(C);
  const [scanType, setScanType] = useState<VisualScanType>(initialType);
  const [isScanning, setIsScanning] = useState(false);
  const [rawText, setRawText] = useState("");
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [aptDoctor, setAptDoctor] = useState("");
  const [aptDate, setAptDate] = useState(new Date().toISOString().slice(0, 10));
  const [aptTime, setAptTime] = useState("09:00");
  const [aptLocation, setAptLocation] = useState("");
  const [aptNotes, setAptNotes] = useState("");
  const [labDoctor, setLabDoctor] = useState("");
  const [labTestName, setLabTestName] = useState("");
  const [labDate, setLabDate] = useState(new Date().toISOString().slice(0, 10));
  const [labNotes, setLabNotes] = useState("");
  const [imagingType, setImagingType] = useState("");
  const [imagingBodyArea, setImagingBodyArea] = useState("");
  const [imagingDoctor, setImagingDoctor] = useState("");
  const [imagingDate, setImagingDate] = useState(new Date().toISOString().slice(0, 10));
  const [imagingNotes, setImagingNotes] = useState("");

  const reset = () => {
    setRawText("");
    setMedName("");
    setMedDosage("");
    setAptDoctor("");
    setAptDate(new Date().toISOString().slice(0, 10));
    setAptTime("09:00");
    setAptLocation("");
    setAptNotes("");
    setLabDoctor("");
    setLabTestName("");
    setLabDate(new Date().toISOString().slice(0, 10));
    setLabNotes("");
    setImagingType("");
    setImagingBodyArea("");
    setImagingDoctor("");
    setImagingDate(new Date().toISOString().slice(0, 10));
    setImagingNotes("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const scan = async (source: "camera" | "library") => {
    const permission = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(source === "camera" ? "Camera access needed" : "Photo access needed", "Allow Synapse to scan medical info.");
      return;
    }

    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: false });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setIsScanning(true);
    try {
      const text = await recognizeTextFromImage(result.assets[0].uri);
      setRawText(text);
      applyParsedText(text, scanType);
    } catch (error: any) {
      Alert.alert("Scan failed", error?.message || "Could not read text from that image.");
    } finally {
      setIsScanning(false);
    }
  };

  const applyParsedText = (text: string, type: VisualScanType) => {
    if (type === "medication") {
      const parsed = parseMedicationScan(text);
      setMedName(parsed.name);
      setMedDosage(parsed.dosage);
      return;
    }
    if (type === "appointment") {
      const parsed = parseAppointmentScan(text);
      setAptDoctor(parsed.doctorName);
      setAptDate(parsed.date);
      setAptTime(parsed.time);
      setAptLocation(parsed.location);
      setAptNotes(parsed.notes);
      return;
    }
    if (type === "lab") {
      const parsed = parseLabScan(text);
      setLabDoctor(parsed.doctorName);
      setLabTestName("Lab Work");
      setLabDate(parsed.date);
      setLabNotes(parsed.notes);
      return;
    }
    const parsed = parseImagingScan(text);
    setImagingType(parsed.type);
    setImagingBodyArea(parsed.bodyArea);
    setImagingDoctor(parsed.doctorName);
    setImagingDate(parsed.date);
    setImagingNotes(parsed.notes);
  };

  const changeType = (type: VisualScanType) => {
    setScanType(type);
    if (rawText) applyParsedText(rawText, type);
  };

  const save = async () => {
    if (scanType === "medication") {
      if (!medName.trim()) return Alert.alert("Medication name needed", "Add a name before saving.");
      const saved = await medicationStorage.save({
        name: medName.trim(),
        dosage: medDosage.trim(),
        frequency: "Daily",
        medicationType: "scheduled",
        active: true,
        source: "scan",
        doses: [{
          id: `scan-${Date.now()}`,
          amount: medDosage.trim(),
          unit: "",
          timeOfDay: "Morning",
          reminderTime: "08:00",
        }],
        entryOwner: "self",
      } as Omit<Medication, "id">);
      await syncWidgetSnapshot().catch(() => {});
      onSaved?.("medication", saved.id);
      close();
      return;
    }

    if (scanType === "appointment") {
      if (!aptDoctor.trim()) return Alert.alert("Appointment name needed", "Add a doctor or appointment name before saving.");
      const saved = await appointmentStorage.save({
        doctorName: aptDoctor.trim(),
        specialty: "",
        date: aptDate.trim(),
        time: aptTime.trim() || "09:00",
        location: aptLocation.trim(),
        notes: aptNotes.trim(),
        entryOwner: "self",
        source: "scan",
      } as Omit<Appointment, "id">);
      await syncWidgetSnapshot().catch(() => {});
      onSaved?.("appointment", saved.id);
      close();
      return;
    }

    if (scanType === "lab") {
      if (!labTestName.trim()) return Alert.alert("Lab test name needed", "Add a test name before saving.");
      const saved = await labWorkStorage.save({
        testName: labTestName.trim(),
        date: labDate.trim(),
        notes: labNotes.trim(),
        status: "completed",
        source: "scan",
      } as Omit<LabWork, "id">);
      onSaved?.("lab", saved.id);
      close();
      return;
    }

    if (!imagingType.trim()) return Alert.alert("Imaging type needed", "Add an imaging type before saving.");
    const saved = await imagingStorage.save({
      type: imagingType.trim(),
      bodyArea: imagingBodyArea.trim() || undefined,
      date: imagingDate.trim(),
      notes: imagingNotes.trim(),
      source: "scan",
    } as Omit<Imaging, "id">);
    onSaved?.("imaging", saved.id);
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close visual scan" />
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>Visual Scan</Text>
                <Text style={styles.title}>Scan to Import</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={close}>
                <Ionicons name="close" size={20} color={C.text} />
              </Pressable>
            </View>

            <View style={styles.segment}>
              {(["medication", "appointment", "lab", "imaging"] as const).map((type) => (
                <Pressable key={type} style={[styles.segmentBtn, scanType === type && styles.segmentBtnActive]} onPress={() => changeType(type)}>
                  <Text style={[styles.segmentText, scanType === type && styles.segmentTextActive]}>
                    {type === "medication" ? "Med" : type === "appointment" ? "Visit" : type === "lab" ? "Lab" : "Imaging"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.scanRow}>
              <Pressable style={styles.scanBtn} onPress={() => scan("camera")} disabled={isScanning}>
                <Ionicons name="camera-outline" size={18} color="#fff" />
                <Text style={styles.scanBtnText}>{isScanning ? "Scanning..." : "Camera"}</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => scan("library")} disabled={isScanning}>
                <Ionicons name="image-outline" size={18} color={C.text} />
                <Text style={styles.secondaryBtnText}>Photo</Text>
              </Pressable>
            </View>

            {scanType === "medication" ? (
              <>
                <Field label="Medication name" value={medName} onChangeText={setMedName} styles={styles} colors={C} />
                <Field label="Dosage" value={medDosage} onChangeText={setMedDosage} styles={styles} colors={C} placeholder="e.g. 10 mg" />
              </>
            ) : scanType === "appointment" ? (
              <>
                <Field label="Doctor / appointment" value={aptDoctor} onChangeText={setAptDoctor} styles={styles} colors={C} />
                <Field label="Date" value={aptDate} onChangeText={setAptDate} styles={styles} colors={C} placeholder="YYYY-MM-DD" />
                <Field label="Time" value={aptTime} onChangeText={setAptTime} styles={styles} colors={C} placeholder="HH:MM" />
                <Field label="Location" value={aptLocation} onChangeText={setAptLocation} styles={styles} colors={C} />
                <Field label="Notes" value={aptNotes} onChangeText={setAptNotes} styles={styles} colors={C} multiline />
              </>
            ) : scanType === "lab" ? (
              <>
                <Field label="Doctor" value={labDoctor} onChangeText={setLabDoctor} styles={styles} colors={C} />
                <Field label="Test name" value={labTestName} onChangeText={setLabTestName} styles={styles} colors={C} placeholder="CBC, metabolic panel, iron panel..." />
                <Field label="Date" value={labDate} onChangeText={setLabDate} styles={styles} colors={C} placeholder="YYYY-MM-DD" />
                <Field label="Notes" value={labNotes} onChangeText={setLabNotes} styles={styles} colors={C} multiline />
              </>
            ) : (
              <>
                <Field label="Type" value={imagingType} onChangeText={setImagingType} styles={styles} colors={C} placeholder="X-ray, MRI, CT, Ultrasound..." />
                <Field label="Body area" value={imagingBodyArea} onChangeText={setImagingBodyArea} styles={styles} colors={C} />
                <Field label="Doctor" value={imagingDoctor} onChangeText={setImagingDoctor} styles={styles} colors={C} />
                <Field label="Date" value={imagingDate} onChangeText={setImagingDate} styles={styles} colors={C} placeholder="YYYY-MM-DD" />
                <Field label="Notes" value={imagingNotes} onChangeText={setImagingNotes} styles={styles} colors={C} multiline />
              </>
            )}

            {!!rawText && (
              <View style={styles.rawBox}>
                <Text style={styles.rawLabel}>Raw scan</Text>
                <Text style={styles.rawText}>{rawText}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={close}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.confirmBtn} onPress={save}>
                <Text style={styles.confirmText}>
                  {scanType === "medication" ? "Add Medication" : scanType === "appointment" ? "Import Appointment" : scanType === "lab" ? "Add Lab Work" : "Add Imaging"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  styles,
  colors: C,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Theme;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textTertiary}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </>
  );
}

function makeStyles(C: Theme) {
  const surface = modalSurface(C);
  const surfaceElevated = modalSurfaceElevated(C);
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: modalOverlay(), justifyContent: "center", alignItems: "center", padding: 22 },
    sheet: { width: "100%", maxWidth: 460, maxHeight: "88%", borderRadius: 22, backgroundColor: surface, borderWidth: 1, borderColor: C.border, padding: 22 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
    eyebrow: { fontWeight: "800", fontSize: 11, color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
    title: { fontWeight: "800", fontSize: 28, color: C.text, letterSpacing: -0.5 },
    closeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: surfaceElevated, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
    segment: { flexDirection: "row", backgroundColor: surfaceElevated, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
    segmentBtn: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: "center" },
    segmentBtnActive: { backgroundColor: surface },
    segmentText: { fontWeight: "700", fontSize: 12, color: C.textSecondary },
    segmentTextActive: { color: C.text },
    scanRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
    scanBtn: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: C.tint, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    scanBtnText: { fontWeight: "800", fontSize: 14, color: "#fff" },
    secondaryBtn: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: surfaceElevated, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    secondaryBtnText: { fontWeight: "800", fontSize: 14, color: C.text },
    label: { fontWeight: "700", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
    input: { fontWeight: "500", fontSize: 14, color: C.text, backgroundColor: surfaceElevated, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
    textArea: { minHeight: 110, lineHeight: 20 },
    rawBox: { borderRadius: 14, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 14 },
    rawLabel: { fontWeight: "800", fontSize: 11, color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
    rawText: { fontWeight: "400", fontSize: 12, color: C.textSecondary, lineHeight: 18 },
    actions: { flexDirection: "row", gap: 10, paddingTop: 4 },
    cancelBtn: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: C.surfaceElevated, alignItems: "center", justifyContent: "center" },
    cancelText: { fontWeight: "800", fontSize: 14, color: C.textSecondary },
    confirmBtn: { flex: 1.25, minHeight: 48, borderRadius: 14, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
    confirmText: { fontWeight: "800", fontSize: 14, color: "#fff" },
  });
}

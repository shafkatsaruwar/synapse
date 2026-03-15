import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  useWindowDimensions,
  Alert,
  Share,
  Modal,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  getEmergencyCard,
  saveEmergencyCard,
  type EmergencyCardData,
} from "@/lib/emergency-card-storage";

const CARD_BG = "#FFFFFF";
const CARD_HEADER = "#800020";
const CARD_TEXT = "#111111";
const CARD_LABEL = "#555555";

interface EmergencyCardScreenProps {
  onBack: () => void;
}

export default function EmergencyCardScreen({ onBack }: EmergencyCardScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const cardRef = useRef<ViewShot>(null);

  const [data, setData] = useState<EmergencyCardData>({
    fullName: "",
    dateOfBirth: "",
    allergies: "",
    currentMedications: "",
    epipenAvailable: false,
    emergencyContactName: "",
    emergencyContactPhone: "",
    primaryDoctorName: "",
    doctorPhone: "",
    optionalNotes: "",
  });
  const [saved, setSaved] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(async () => {
    const stored = await getEmergencyCard();
    setData(stored);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback((patch: Partial<EmergencyCardData>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    await saveEmergencyCard(data);
    setSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [data]);

  const captureCard = useCallback(async (): Promise<string | null> => {
    try {
      const ref = cardRef.current as { capture?: () => Promise<string> } | null;
      const uri = ref?.capture ? await ref.capture() : null;
      return uri ?? null;
    } catch {
      return null;
    }
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    const uri = await captureCard();
    setExporting(false);
    if (!uri) {
      Alert.alert("Export failed", "Could not capture the card. Try again.");
      return;
    }
    try {
      const fileUri = uri.startsWith("file://") ? uri : `file://${uri}`;
      await Share.share({
        url: fileUri,
        message: "My Synapse Emergency Card",
        title: "Emergency Card",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      // User cancelled
    }
  }, [captureCard]);

  const handleSaveToPhone = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not available", "Saving to camera roll is not supported on web.");
      return;
    }
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to save the emergency card.");
      return;
    }
    setSaving(true);
    const uri = await captureCard();
    setSaving(false);
    if (!uri) {
      Alert.alert("Save failed", "Could not capture the card. Try again.");
      return;
    }
    try {
      const fileUri = uri.startsWith("file://") ? uri : `file://${uri}`;
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Emergency card saved to your camera roll.");
    } catch (e) {
      Alert.alert("Save failed", "Could not save to camera roll.");
    }
  }, [captureCard]);

  const cardWidth = Math.min(width - 48, 340);
  const previewCard = (
    <ViewShot
      ref={cardRef}
      options={{ format: "png", quality: 1, result: "tmpfile" }}
      style={[styles.cardPreviewWrap, { width: cardWidth }]}
    >
      <View style={[styles.emergencyCard, { width: cardWidth - 32 }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="medkit" size={24} color="#fff" />
          <Text style={styles.cardHeaderTitle}>MEDICAL EMERGENCY CARD</Text>
        </View>
        <View style={styles.cardBody}>
          <Row label="Name" value={data.fullName || "—"} />
          <Row label="Date of Birth" value={data.dateOfBirth || "—"} />
          <Row label="Allergies" value={data.allergies || "None"} />
          <Row label="Current Medications" value={data.currentMedications || "—"} />
          <Row label="EpiPen" value={data.epipenAvailable ? "Yes" : "No"} />
          <Row label="Emergency Contact" value={data.emergencyContactName || "—"} />
          <Row label="Contact Phone" value={data.emergencyContactPhone || "—"} />
          <Row label="Primary Doctor" value={data.primaryDoctorName || "—"} />
          <Row label="Doctor Phone" value={data.doctorPhone || "—"} />
          {data.optionalNotes ? (
            <Row label="Notes" value={data.optionalNotes} />
          ) : null}
        </View>
      </View>
    </ViewShot>
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={C.text} />
          </Pressable>
          <Text style={styles.title}>Emergency Card</Text>
          <Text style={styles.subtitle}>Create a card to show or share in an emergency</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your details</Text>
          <Field label="Full Name" value={data.fullName} onChange={(v) => update({ fullName: v })} placeholder="Full name" />
          <Field label="Date of Birth" value={data.dateOfBirth} onChange={(v) => update({ dateOfBirth: v })} placeholder="e.g. Jan 15, 1990" />
          <Field label="Allergies" value={data.allergies} onChange={(v) => update({ allergies: v })} placeholder="List allergies" multiline />
          <Field label="Current Medications" value={data.currentMedications} onChange={(v) => update({ currentMedications: v })} placeholder="List medications" multiline />
          <View style={styles.toggleRow}>
            <Text style={styles.label}>EpiPen available</Text>
            <Switch
              value={data.epipenAvailable}
              onValueChange={(v) => update({ epipenAvailable: v })}
              trackColor={{ false: C.border, true: C.tintLight }}
              thumbColor={data.epipenAvailable ? C.tint : "#f4f3f4"}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency contact</Text>
          <Field label="Name" value={data.emergencyContactName} onChange={(v) => update({ emergencyContactName: v })} placeholder="Contact name" />
          <Field label="Phone" value={data.emergencyContactPhone} onChange={(v) => update({ emergencyContactPhone: v })} placeholder="Phone number" keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary doctor</Text>
          <Field label="Name" value={data.primaryDoctorName} onChange={(v) => update({ primaryDoctorName: v })} placeholder="Doctor name" />
          <Field label="Phone" value={data.doctorPhone} onChange={(v) => update({ doctorPhone: v })} placeholder="Doctor phone" keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <Field label="Optional notes" value={data.optionalNotes} onChange={(v) => update({ optionalNotes: v })} placeholder="Other important info" multiline />
        </View>

        {!saved && (
          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save details</Text>
          </Pressable>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview</Text>
          {previewCard}
          <Pressable
            style={styles.fullscreenBtn}
            onPress={() => setFullscreen(true)}
          >
            <Ionicons name="expand-outline" size={20} color={C.tint} />
            <Text style={styles.fullscreenBtnText}>Show fullscreen emergency card</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
            onPress={handleExport}
            disabled={exporting}
          >
            <Ionicons name="share-outline" size={20} color="#fff" />
            <Text style={styles.exportBtnText}>
              {exporting ? "Preparing…" : "Export Emergency Card"}
            </Text>
          </Pressable>
          {Platform.OS !== "web" && (
            <Pressable
              style={[styles.saveToPhoneBtn, saving && styles.exportBtnDisabled]}
              onPress={handleSaveToPhone}
              disabled={saving}
            >
              <Ionicons name="images-outline" size={20} color={C.tint} />
              <Text style={styles.saveToPhoneBtnText}>
                {saving ? "Saving…" : "Save to Phone"}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <Modal visible={fullscreen} transparent animationType="fade">
        <Pressable style={styles.fullscreenOverlay} onPress={() => setFullscreen(false)}>
          <View style={[styles.fullscreenCard, { width: Math.min(width - 48, 400) }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="medkit" size={28} color="#fff" />
              <Text style={[styles.cardHeaderTitle, { fontSize: 16 }]}>MEDICAL EMERGENCY CARD</Text>
            </View>
            <View style={styles.cardBody}>
              <Row label="Name" value={data.fullName || "—"} large />
              <Row label="Date of Birth" value={data.dateOfBirth || "—"} large />
              <Row label="Allergies" value={data.allergies || "None"} large />
              <Row label="Current Medications" value={data.currentMedications || "—"} large />
              <Row label="EpiPen" value={data.epipenAvailable ? "Yes" : "No"} large />
              <Row label="Emergency Contact" value={data.emergencyContactName || "—"} large />
              <Row label="Contact Phone" value={data.emergencyContactPhone || "—"} large />
              <Row label="Primary Doctor" value={data.primaryDoctorName || "—"} large />
              <Row label="Doctor Phone" value={data.doctorPhone || "—"} large />
              {data.optionalNotes ? <Row label="Notes" value={data.optionalNotes} large /> : null}
            </View>
            <Text style={styles.tapToClose}>Tap outside to close</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function Row({
  label,
  value,
  large,
}: { label: string; value: string; large?: boolean }) {
  return (
    <View style={large ? cardRowStyles.largeRow : cardRowStyles.row}>
      <Text style={large ? cardRowStyles.largeLabel : cardRowStyles.label}>{label}</Text>
      <Text style={large ? cardRowStyles.largeValue : cardRowStyles.value}>{value}</Text>
    </View>
  );
}

const cardRowStyles = StyleSheet.create({
  row: { marginBottom: 10 },
  largeRow: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: "600", color: CARD_LABEL, marginBottom: 2, textTransform: "uppercase" },
  largeLabel: { fontSize: 12, fontWeight: "600", color: CARD_LABEL, marginBottom: 4, textTransform: "uppercase" },
  value: { fontSize: 14, fontWeight: "500", color: CARD_TEXT },
  largeValue: { fontSize: 18, fontWeight: "600", color: CARD_TEXT },
});

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "phone-pad" | "default";
}) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textTertiary}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 24 },
    header: { marginBottom: 24 },
    backBtn: { marginBottom: 12, alignSelf: "flex-start" },
    title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5 },
    subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginTop: 4 },
    section: { marginBottom: 24 },
    sectionTitle: { fontWeight: "600", fontSize: 15, color: C.text, marginBottom: 12 },
    field: { marginBottom: 14 },
    label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
    input: {
      backgroundColor: C.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: C.text,
      borderWidth: 1,
      borderColor: C.border,
    },
    inputMultiline: { minHeight: 80, textAlignVertical: "top" },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    saveBtn: {
      backgroundColor: C.tint,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 24,
    },
    saveBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
    cardPreviewWrap: {
      alignSelf: "center",
      padding: 16,
      backgroundColor: C.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 6,
    },
    emergencyCard: {
      backgroundColor: CARD_BG,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "#E5E5E5",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: CARD_HEADER,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    cardHeaderTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: "#fff",
      letterSpacing: 0.5,
    },
    cardBody: { padding: 16 },
    fullscreenBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 12,
      paddingVertical: 10,
    },
    fullscreenBtnText: { fontWeight: "600", fontSize: 14, color: C.tint },
    actions: { gap: 12, marginTop: 8 },
    exportBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: C.tint,
      borderRadius: 14,
      paddingVertical: 16,
    },
    exportBtnDisabled: { opacity: 0.7 },
    exportBtnText: { fontWeight: "600", fontSize: 16, color: "#fff" },
    saveToPhoneBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: C.tintLight,
      borderRadius: 14,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: C.tint,
    },
    saveToPhoneBtnText: { fontWeight: "600", fontSize: 16, color: C.tint },
    fullscreenOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.85)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    fullscreenCard: {
      backgroundColor: CARD_BG,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: CARD_HEADER,
    },
    tapToClose: {
      fontSize: 12,
      color: CARD_LABEL,
      textAlign: "center",
      paddingVertical: 12,
    },
  });
}

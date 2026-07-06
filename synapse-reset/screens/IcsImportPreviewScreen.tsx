import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appointmentStorage } from "@/lib/storage";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { clearPendingIcsImport, type IcsImportEvent, type IcsImportPayload } from "@/lib/ics-import";
import { syncWidgetSnapshot } from "@/lib/widget-sync";

type Props = {
  visible: boolean;
  payload: IcsImportPayload | null;
  onClose: () => void;
  onImported: () => void;
  modal?: boolean;
};

export default function IcsImportPreviewScreen({ visible, payload, onClose, onImported, modal = true }: Props) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const events = payload?.events ?? [];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = events[selectedIndex] ?? events[0] ?? null;
  const [draft, setDraft] = useState<IcsImportEvent>(selected ?? emptyEvent());

  React.useEffect(() => {
    const next = (payload?.events ?? [])[0] ?? emptyEvent();
    setSelectedIndex(0);
    setDraft(next);
  }, [payload]);

  const selectEvent = (index: number) => {
    const next = events[index];
    if (!next) return;
    setSelectedIndex(index);
    setDraft(next);
  };

  const handleSave = async () => {
    if (!draft.title.trim() || !draft.date.trim()) {
      Alert.alert("Missing info", "Add a title and date before saving.");
      return;
    }

    const notes = [
      draft.notes.trim(),
      draft.endTime.trim() ? `Ends at ${draft.endTime.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    await appointmentStorage.save({
      doctorName: draft.title.trim(),
      doctor_id: undefined,
      specialty: "",
      date: draft.date.trim(),
      time: draft.time.trim() || "09:00",
      location: draft.location.trim(),
      notes,
      entryOwner: "self",
    });
    await clearPendingIcsImport().catch(() => {});
    await syncWidgetSnapshot().catch(() => {});
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onImported();
  };

  const handleClose = async () => {
    await clearPendingIcsImport().catch(() => {});
    onClose();
  };

  const content = (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close import" onPress={handleClose} style={styles.iconButton}>
            <Ionicons name="close" size={24} color={C.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>ICS Import</Text>
            <Text style={styles.title}>Import Preview</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Add appointment" onPress={handleSave} style={styles.saveIconButton}>
            <Ionicons name="checkmark" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
        >
          {events.length > 1 ? (
            <View style={styles.eventTabs}>
              {events.map((event, index) => (
                <Pressable
                  key={`${event.title}-${event.date}-${index}`}
                  onPress={() => selectEvent(index)}
                  style={[styles.eventTab, index === selectedIndex && styles.eventTabActive]}
                >
                  <Text style={[styles.eventTabText, index === selectedIndex && styles.eventTabTextActive]}>
                    {index + 1}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {selected ? (
            <View style={styles.form}>
              <Field label="Title" value={draft.title} onChangeText={(title) => setDraft((prev) => ({ ...prev, title }))} styles={styles} />
              <View style={styles.row}>
                <Field label="Date" value={draft.date} onChangeText={(date) => setDraft((prev) => ({ ...prev, date }))} styles={styles} />
                <Field label="Time" value={draft.time} onChangeText={(time) => setDraft((prev) => ({ ...prev, time }))} styles={styles} />
              </View>
              <Field label="End time" value={draft.endTime} onChangeText={(endTime) => setDraft((prev) => ({ ...prev, endTime }))} styles={styles} />
              <Field label="Location" value={draft.location} onChangeText={(location) => setDraft((prev) => ({ ...prev, location }))} styles={styles} />
              <Field
                label="Notes"
                value={draft.notes}
                onChangeText={(notes) => setDraft((prev) => ({ ...prev, notes }))}
                multiline
                styles={styles}
              />
              <Pressable onPress={handleSave} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
                <Text style={styles.primaryButtonText}>Add Appointment</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No appointment found</Text>
              <Text style={styles.emptyText}>This file did not include a readable calendar event.</Text>
            </View>
          )}
        </ScrollView>
    </KeyboardAvoidingView>
  );

  if (!modal) {
    return visible ? content : null;
  }

  return (
    <Modal animationType="slide" visible={visible} presentationStyle="pageSheet" onRequestClose={handleClose}>
      {content}
    </Modal>
  );
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

function emptyEvent(): IcsImportEvent {
  return { title: "Appointment", date: "", time: "09:00", endTime: "", location: "", notes: "" };
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 18,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
      backgroundColor: C.surface,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
    },
    saveIconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.purple,
    },
    headerText: { flex: 1 },
    eyebrow: { color: C.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
    title: { color: C.text, fontSize: 24, fontWeight: "800" },
    scroll: { flex: 1 },
    content: { padding: 18, gap: 16 },
    eventTabs: { flexDirection: "row", gap: 8 },
    eventTab: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    eventTabActive: { backgroundColor: C.purple, borderColor: C.purple },
    eventTabText: { color: C.text, fontWeight: "800" },
    eventTabTextActive: { color: "#FFFFFF" },
    form: { gap: 14 },
    row: { flexDirection: "row", gap: 12 },
    field: { flex: 1, gap: 7 },
    label: { color: C.textSecondary, fontSize: 13, fontWeight: "700" },
    input: {
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: C.text,
      fontSize: 16,
      fontWeight: "600",
    },
    notesInput: { minHeight: 130 },
    primaryButton: {
      minHeight: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.purple,
      marginTop: 4,
    },
    primaryButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
    buttonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
    emptyState: {
      minHeight: 240,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    emptyTitle: { color: C.text, fontSize: 22, fontWeight: "800" },
    emptyText: { color: C.textSecondary, fontSize: 16, textAlign: "center" },
  });
}

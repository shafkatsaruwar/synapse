import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { raised } from "@/constants/raised";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { healthProfileStorage, type HealthProfileInfo, type SurgeryRecord } from "@/lib/storage";
import { syncAllFromSettings } from "@/lib/notification-manager";

interface SurgeriesScreenProps {
  onBack?: () => void;
}

export default function SurgeriesScreen(_props: SurgeriesScreenProps) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [profile, setProfile] = useState<HealthProfileInfo>({
    userRole: "self",
    widgetAppearance: "system",
    backupCriticalMedications: [],
    surgeries: [],
  });
  const [surgeryProcedure, setSurgeryProcedure] = useState("");
  const [surgeryEstimatedWhen, setSurgeryEstimatedWhen] = useState("");
  const [surgeryLocation, setSurgeryLocation] = useState("");

  const loadData = useCallback(async () => {
    setProfile(await healthProfileStorage.get());
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const persistProfile = async (nextProfile: HealthProfileInfo) => {
    setProfile(nextProfile);
    await healthProfileStorage.save(nextProfile);
    await syncAllFromSettings().catch(() => {});
  };

  const resetForm = () => {
    setSurgeryProcedure("");
    setSurgeryEstimatedWhen("");
    setSurgeryLocation("");
  };

  const handleAdd = async () => {
    if (!surgeryProcedure.trim() || !surgeryEstimatedWhen.trim()) return;
    const nextSurgeries: SurgeryRecord[] = [
      {
        id: `${Date.now()}`,
        procedure: surgeryProcedure.trim(),
        estimatedWhen: surgeryEstimatedWhen.trim(),
        location: surgeryLocation.trim() || undefined,
      },
      ...(profile.surgeries ?? []),
    ];
    await persistProfile({ ...profile, surgeries: nextSurgeries });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    const nextSurgeries = (profile.surgeries ?? []).filter((item) => item.id !== id);
    await persistProfile({ ...profile, surgeries: nextSurgeries });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const topPad = Platform.OS === "web" ? 40 : 14;
  const surgeries = profile.surgeries ?? [];

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topPad,
            paddingBottom: isWide ? 40 : Platform.OS === "web" ? 118 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Surgeries</Text>
        <Text style={styles.subtitle}>Keep a simple record of procedures and when they happened</Text>

        {surgeries.length > 0 ? (
          <View style={styles.listCard}>
            {surgeries.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.recordRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordTitle}>{item.procedure}</Text>
                    <Text style={styles.recordText}>
                      {item.estimatedWhen}
                      {item.location ? ` • ${item.location}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleDelete(item.id)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${item.procedure}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={C.textTertiary} />
                  </Pressable>
                </View>
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No surgeries added yet</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>Add surgery</Text>
        <View style={styles.formCard}>
          <Text style={styles.label}>What was done? *</Text>
          <TextInput
            style={styles.input}
            value={surgeryProcedure}
            onChangeText={setSurgeryProcedure}
            placeholder="e.g. Appendectomy"
            placeholderTextColor={C.textTertiary}
          />
          <Text style={styles.label}>Estimated when? *</Text>
          <TextInput
            style={styles.input}
            value={surgeryEstimatedWhen}
            onChangeText={setSurgeryEstimatedWhen}
            placeholder="e.g. Summer 2022"
            placeholderTextColor={C.textTertiary}
          />
          <Text style={styles.label}>Where</Text>
          <TextInput
            style={styles.input}
            value={surgeryLocation}
            onChangeText={setSurgeryLocation}
            placeholder="Hospital or clinic"
            placeholderTextColor={C.textTertiary}
          />
          <Pressable
            style={[
              styles.saveBtn,
              (!surgeryProcedure.trim() || !surgeryEstimatedWhen.trim()) && { opacity: 0.5 },
            ]}
            onPress={handleAdd}
            disabled={!surgeryProcedure.trim() || !surgeryEstimatedWhen.trim()}
            accessibilityRole="button"
            accessibilityLabel="Save surgery"
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 24 },
    title: { fontWeight: "700", fontSize: 26, color: C.text, letterSpacing: -0.5, marginBottom: 8 },
    subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginBottom: 24 },
    listCard: {
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 20,
      ...raised("md", "#55718F"),
    },
    emptyCard: {
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 20,
      marginBottom: 20,
      ...raised("md", "#55718F"),
    },
    emptyText: { fontWeight: "400", fontSize: 14, color: C.textSecondary },
    recordRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16 },
    recordTitle: { fontWeight: "600", fontSize: 15, color: C.text },
    recordText: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 4, lineHeight: 18 },
    divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
    sectionLabel: {
      fontWeight: "700",
      fontSize: 12,
      color: C.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 12,
    },
    formCard: {
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 20,
      borderWidth: 1,
      borderColor: C.border,
      ...raised("md", "#55718F"),
    },
    label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
    input: {
      fontWeight: "400",
      fontSize: 14,
      color: C.text,
      backgroundColor: C.surfaceElevated,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 14,
    },
    saveBtn: {
      backgroundColor: C.purple,
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      ...raised("md", C.purple),
    },
    saveBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
  });
}

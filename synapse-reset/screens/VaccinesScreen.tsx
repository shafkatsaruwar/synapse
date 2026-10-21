import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  Image,
  useWindowDimensions,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { raised } from "@/constants/raised";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { healthProfileStorage, type HealthProfileInfo, type VaccineRecord } from "@/lib/storage";
import { syncAllFromSettings } from "@/lib/notification-manager";

interface VaccinesScreenProps {
  onBack?: () => void;
}

export default function VaccinesScreen(_props: VaccinesScreenProps) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [profile, setProfile] = useState<HealthProfileInfo>({
    userRole: "self",
    widgetAppearance: "system",
    backupCriticalMedications: [],
    vaccines: [],
  });
  const [vaccineName, setVaccineName] = useState("");
  const [vaccineDate, setVaccineDate] = useState("");
  const [vaccineLocation, setVaccineLocation] = useState("");
  const [vaccineLotNumber, setVaccineLotNumber] = useState("");
  const [vaccineRecordImageUri, setVaccineRecordImageUri] = useState("");

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
    setVaccineName("");
    setVaccineDate("");
    setVaccineLocation("");
    setVaccineLotNumber("");
    setVaccineRecordImageUri("");
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Please allow photo library access to attach a vaccine record photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setVaccineRecordImageUri(result.assets[0].uri);
    Haptics.selectionAsync();
  };

  const handleAdd = async () => {
    if (!vaccineName.trim() || !vaccineDate.trim()) return;
    const nextVaccines: VaccineRecord[] = [
      {
        id: `${Date.now()}`,
        vaccine: vaccineName.trim(),
        receivedAt: vaccineDate.trim(),
        location: vaccineLocation.trim() || undefined,
        lotNumber: vaccineLotNumber.trim() || undefined,
        recordImageUri: vaccineRecordImageUri || undefined,
      },
      ...(profile.vaccines ?? []),
    ];
    await persistProfile({ ...profile, vaccines: nextVaccines });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    const nextVaccines = (profile.vaccines ?? []).filter((item) => item.id !== id);
    await persistProfile({ ...profile, vaccines: nextVaccines });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const topPad = Platform.OS === "web" ? 40 : 14;
  const vaccines = profile.vaccines ?? [];

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
        <Text style={styles.title}>Vaccines</Text>
        <Text style={styles.subtitle}>Record vaccines, dates, and optional record photos</Text>

        {vaccines.length > 0 ? (
          <View style={styles.listCard}>
            {vaccines.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.recordRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordTitle}>{item.vaccine}</Text>
                    <Text style={styles.recordText}>
                      {item.receivedAt}
                      {item.location ? ` • ${item.location}` : ""}
                      {item.lotNumber ? ` • Lot ${item.lotNumber}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleDelete(item.id)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${item.vaccine}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={C.textTertiary} />
                  </Pressable>
                </View>
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No vaccines added yet</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>Add vaccine</Text>
        <View style={styles.formCard}>
          <Text style={styles.label}>Vaccine *</Text>
          <TextInput
            style={styles.input}
            value={vaccineName}
            onChangeText={setVaccineName}
            placeholder="e.g. COVID-19 booster"
            placeholderTextColor={C.textTertiary}
          />
          <Text style={styles.label}>Date taken *</Text>
          <TextInput
            style={styles.input}
            value={vaccineDate}
            onChangeText={setVaccineDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.textTertiary}
          />
          <Text style={styles.label}>Where taken</Text>
          <TextInput
            style={styles.input}
            value={vaccineLocation}
            onChangeText={setVaccineLocation}
            placeholder="Clinic, pharmacy, hospital..."
            placeholderTextColor={C.textTertiary}
          />
          <Text style={styles.label}>Lot number</Text>
          <TextInput
            style={styles.input}
            value={vaccineLotNumber}
            onChangeText={setVaccineLotNumber}
            placeholder="If you have it"
            placeholderTextColor={C.textTertiary}
          />
          <Text style={styles.label}>Vaccine record photo</Text>
          <Pressable
            style={styles.imagePickerBtn}
            onPress={handlePickImage}
            accessibilityRole="button"
            accessibilityLabel="Attach vaccine record photo"
          >
            <Ionicons name="image-outline" size={18} color={C.purple} />
            <Text style={styles.imagePickerText}>{vaccineRecordImageUri ? "Change photo" : "Attach photo"}</Text>
          </Pressable>
          {vaccineRecordImageUri ? (
            <Image source={{ uri: vaccineRecordImageUri }} style={styles.imagePreview} />
          ) : null}
          <Pressable
            style={[styles.saveBtn, (!vaccineName.trim() || !vaccineDate.trim()) && { opacity: 0.5 }]}
            onPress={handleAdd}
            disabled={!vaccineName.trim() || !vaccineDate.trim()}
            accessibilityRole="button"
            accessibilityLabel="Save vaccine"
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
    imagePickerBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
      marginBottom: 14,
      ...raised("sm", "#6A7BA0"),
    },
    imagePickerText: { fontWeight: "600", fontSize: 13, color: C.purple },
    imagePreview: { width: "100%", height: 180, borderRadius: 14, marginBottom: 14, backgroundColor: C.surfaceElevated },
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

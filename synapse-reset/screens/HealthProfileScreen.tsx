import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable, Platform } from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { conditionStorage, healthProfileStorage, settingsStorage } from "@/lib/storage";

interface HealthProfileScreenProps {
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

export default function HealthProfileScreen({ onBack, onNavigate }: HealthProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [conditionsCount, setConditionsCount] = useState(0);
  const [nameText, setNameText] = useState("");
  const [nameSaved, setNameSaved] = useState(true);
  const [ageText, setAgeText] = useState("");
  const [ageSaved, setAgeSaved] = useState(true);

  const loadData = useCallback(async () => {
    const [conds, profile, settings] = await Promise.all([
      conditionStorage.getAll(),
      healthProfileStorage.get(),
      settingsStorage.get(),
    ]);
    setConditionsCount(conds.length);
    setNameText(settings.name ?? "");
    setAgeText(profile.age != null ? String(profile.age) : "");
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveName = async () => {
    const trimmed = nameText.trim();
    const settings = await settingsStorage.get();
    await settingsStorage.save({ ...settings, name: trimmed || settings.name || "You" });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNameSaved(true);
  };

  const handleSaveAge = async () => {
    const parsed = ageText.trim() === "" ? undefined : parseInt(ageText, 10);
    await healthProfileStorage.save({ age: isNaN(parsed as number) ? undefined : parsed });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAgeSaved(true);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button" accessibilityLabel="Back to Settings">
          <Ionicons name="arrow-back" size={22} color={C.text} />
          <Text style={styles.backText}>Settings</Text>
        </Pressable>

        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>Name, age, conditions, allergies, and emergency info</Text>

        <View style={styles.ageCard}>
          <Text style={styles.ageLabel}>Name</Text>
          <TextInput
            style={styles.ageInput}
            value={nameText}
            onChangeText={(t) => {
              setNameText(t);
              setNameSaved(false);
            }}
            placeholder="What should we call you?"
            placeholderTextColor={C.textTertiary}
            accessibilityLabel="Name"
            autoCapitalize="words"
          />
          <Pressable
            style={({ pressed }) => [styles.ageSaveBtn, nameSaved && styles.ageSaveBtnSaved, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSaveName}
            accessibilityRole="button"
            accessibilityLabel={nameSaved ? "Name saved" : "Save name"}
          >
            <Ionicons name={nameSaved ? "checkmark-circle" : "save-outline"} size={16} color="#fff" />
            <Text style={styles.ageSaveBtnText}>{nameSaved ? "Saved" : "Save"}</Text>
          </Pressable>
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.ageCard}>
          <Text style={styles.ageLabel}>Age</Text>
          <TextInput
            style={styles.ageInput}
            value={ageText}
            onChangeText={(t) => {
              setAgeText(t.replace(/[^0-9]/g, ""));
              setAgeSaved(false);
            }}
            keyboardType="number-pad"
            placeholder="Enter your age"
            placeholderTextColor={C.textTertiary}
            maxLength={3}
            accessibilityLabel="Age"
          />
          <Pressable
            style={({ pressed }) => [styles.ageSaveBtn, ageSaved && styles.ageSaveBtnSaved, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSaveAge}
            accessibilityRole="button"
            accessibilityLabel={ageSaved ? "Age saved" : "Save age"}
          >
            <Ionicons name={ageSaved ? "checkmark-circle" : "save-outline"} size={16} color="#fff" />
            <Text style={styles.ageSaveBtnText}>{ageSaved ? "Saved" : "Save"}</Text>
          </Pressable>
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.card}>
          <Pressable
            style={styles.profileRow}
            onPress={() => {
              Haptics.selectionAsync();
              onNavigate("healthprofileconditions");
            }}
            accessibilityRole="button"
            accessibilityLabel={`Conditions, ${conditionsCount} added`}
          >
            <View style={[styles.profileIcon, { backgroundColor: C.tintLight }]}>
              <Ionicons name="clipboard-outline" size={16} color={C.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileRowTitle}>Conditions</Text>
              <Text style={styles.profileRowDesc}>
                {conditionsCount > 0 ? `${conditionsCount} condition${conditionsCount !== 1 ? "s" : ""} added` : "None added yet"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={styles.profileRow}
            onPress={() => {
              Haptics.selectionAsync();
              onNavigate("allergy");
            }}
            accessibilityRole="button"
            accessibilityLabel="Allergy and emergency info"
          >
            <View style={[styles.profileIcon, { backgroundColor: C.orangeLight }]}>
              <Ionicons name="warning-outline" size={16} color={C.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileRowTitle}>Allergy & Emergency Info</Text>
              <Text style={styles.profileRowDesc}>Allergies, EpiPen, emergency details</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
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
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  backText: { fontWeight: "600", fontSize: 15, color: C.text },
  title: { fontWeight: "700", fontSize: 26, color: C.text, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginBottom: 24 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  profileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  profileRowTitle: { fontWeight: "600", fontSize: 15, color: C.text },
  profileRowDesc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.border, marginLeft: 16, marginRight: 16 },
  ageCard: { backgroundColor: C.surface, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.border },
  ageLabel: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 8 },
  ageInput: { fontWeight: "400", fontSize: 16, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  ageSaveBtn: { backgroundColor: C.tint, borderRadius: 10, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  ageSaveBtnSaved: { backgroundColor: C.green },
  ageSaveBtnText: { fontWeight: "600", fontSize: 14, color: "#fff" },
});
}

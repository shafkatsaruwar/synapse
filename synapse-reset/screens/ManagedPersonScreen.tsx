import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import TextInput from "@/components/DoneTextInput";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useRole } from "@/contexts/RoleContext";

interface ManagedPersonScreenProps {
  onBack?: () => void;
}

export default function ManagedPersonScreen({ onBack }: ManagedPersonScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C, themeId } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeId), [C, themeId]);
  const { caregiverProfile, saveCaregiverProfile } = useRole();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [relation, setRelation] = useState("");

  useEffect(() => {
    setName(caregiverProfile?.name ?? "");
    setAge(caregiverProfile?.age ? String(caregiverProfile.age) : "");
    setRelation(caregiverProfile?.relation ?? "");
  }, [caregiverProfile]);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Add the managed person’s name.");
      return;
    }
    await saveCaregiverProfile({
      name: trimmedName,
      age: age.trim() ? Math.max(0, parseInt(age, 10) || 0) : 0,
      relation: relation.trim() || undefined,
      medications: caregiverProfile?.medications ?? [],
      appointments: caregiverProfile?.appointments ?? [],
      logs: caregiverProfile?.logs ?? [],
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onBack?.();
  };

  const topPad = isWide ? 28 : Platform.OS === "web" ? 40 : insets.top + 10;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: isWide ? 40 : insets.bottom + 118 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Caregiver</Text>
            <Text style={styles.title}>Managed Person</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={28} color={C.tint} />
          </View>
          <Text style={styles.cardTitle}>{caregiverProfile?.name || "Set up profile"}</Text>
          <Text style={styles.cardMeta}>
            {caregiverProfile?.age ? `${caregiverProfile.age} years old` : "Age not set"}
            {caregiverProfile?.relation ? ` · ${caregiverProfile.relation}` : ""}
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={C.textTertiary} />
          </View>
          <View>
            <Text style={styles.label}>Age</Text>
            <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="Age" placeholderTextColor={C.textTertiary} keyboardType="number-pad" />
          </View>
          <View>
            <Text style={styles.label}>Relation optional</Text>
            <TextInput style={styles.input} value={relation} onChangeText={setRelation} placeholder="Parent, spouse, child..." placeholderTextColor={C.textTertiary} />
          </View>
          <Pressable style={styles.primaryButton} onPress={save}>
            <Text style={styles.primaryButtonText}>Save profile</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Theme, themeId: string) {
  const solidSurface = themeId === "dark" ? "#1B1719" : "#FFFCF8";
  const solidElevated = themeId === "dark" ? "#241F22" : "#FFFFFF";
  return StyleSheet.create({
    screen: { flex: 1 },
    content: { paddingHorizontal: 18, gap: 14 },
    header: { flexDirection: "row", alignItems: "center", gap: 12 },
    backButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: solidSurface },
    headerText: { flex: 1, minWidth: 0 },
    eyebrow: { fontSize: 12, fontWeight: "800", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.6 },
    title: { fontSize: 30, fontWeight: "900", color: C.text },
    card: { backgroundColor: solidSurface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 18, alignItems: "center" },
    avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    cardTitle: { fontSize: 22, fontWeight: "900", color: C.text },
    cardMeta: { marginTop: 4, fontSize: 13, fontWeight: "700", color: C.textSecondary },
    formCard: { backgroundColor: solidSurface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16, gap: 14 },
    sectionTitle: { fontSize: 16, fontWeight: "900", color: C.text },
    label: { fontSize: 12, fontWeight: "900", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: C.text, fontWeight: "700", backgroundColor: solidElevated },
    primaryButton: { marginTop: 4, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.tint },
    primaryButtonText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  });
}

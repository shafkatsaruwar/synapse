import React, { useState, useCallback } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { conditionStorage } from "@/lib/storage";

const C = Colors.dark;

interface HealthProfileScreenProps {
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

export default function HealthProfileScreen({ onBack, onNavigate }: HealthProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const [conditionsCount, setConditionsCount] = useState(0);

  const loadData = useCallback(async () => {
    const conds = await conditionStorage.getAll();
    setConditionsCount(conds.length);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

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

        <Text style={styles.title}>Health Profile</Text>
        <Text style={styles.subtitle}>Conditions and allergy & emergency info</Text>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
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
});

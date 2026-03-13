import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Linking, Platform, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { getMedList, type MedListItem } from "@/lib/med-list-storage";

interface PharmaciesScreenProps {
  onBack: () => void;
}

function groupByPharmacy(items: MedListItem[]): Map<string, MedListItem[]> {
  const map = new Map<string, MedListItem[]>();
  for (const item of items) {
    const key = (item.pharmacyName || "").trim() || "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

export default function PharmaciesScreen({ onBack }: PharmaciesScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [items, setItems] = useState<MedListItem[]>([]);

  const loadData = useCallback(async () => {
    const list = await getMedList();
    setItems(list);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groups = groupByPharmacy(items);
  const topPad = isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16);

  if (items.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back to Settings">
            <Ionicons name="arrow-back" size={24} color={C.text} />
          </Pressable>
          <Text style={styles.title}>Pharmacies</Text>
        </View>
        <View style={styles.empty}>
          <Ionicons name="storefront-outline" size={48} color={C.textTertiary} />
          <Text style={styles.emptyTitle}>No medications added yet</Text>
          <Text style={styles.emptyDesc}>Add medications in the Medications List to see your pharmacies here.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back to Settings">
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Pharmacies</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {Array.from(groups.entries()).map(([pharmacyName, meds]) => {
          const hasPhone = meds.some((m) => (m.pharmacyPhone || "").trim());
          const hasAddress = meds.some((m) => (m.pharmacyAddress || "").trim());
          const phone = meds[0]?.pharmacyPhone?.trim() || "";
          const address = meds[0]?.pharmacyAddress?.trim() || "";
          return (
            <View key={pharmacyName} style={styles.card}>
              <Text style={styles.cardTitle}>{pharmacyName}</Text>
              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.actionBtn, !hasPhone && styles.actionBtnDisabled]}
                  onPress={() => hasPhone && Linking.openURL(`tel:${phone}`)}
                  disabled={!hasPhone}
                  accessibilityRole="button"
                  accessibilityLabel={hasPhone ? `Call ${pharmacyName}` : "No phone saved"}
                >
                  <Ionicons name="call-outline" size={18} color={hasPhone ? C.tint : C.textTertiary} />
                  <Text style={[styles.actionBtnText, !hasPhone && styles.actionBtnTextDisabled]}>{hasPhone ? "Call" : "No phone saved"}</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, !hasAddress && styles.actionBtnDisabled]}
                  onPress={() => hasAddress && Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(address)}`)}
                  disabled={!hasAddress}
                  accessibilityRole="button"
                  accessibilityLabel={hasAddress ? `Directions to ${pharmacyName}` : "No address saved"}
                >
                  <Ionicons name="navigate-outline" size={18} color={hasAddress ? C.tint : C.textTertiary} />
                  <Text style={[styles.actionBtnText, !hasAddress && styles.actionBtnTextDisabled]}>{hasAddress ? "Directions" : "No address saved"}</Text>
                </Pressable>
              </View>
              <View style={styles.medList}>
                {meds.map((med) => (
                  <View key={med.id} style={styles.medRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.medName} numberOfLines={1}>{med.name}</Text>
                      {med.doses?.length ? med.doses.map((d, i) => (
                        <Text key={i} style={styles.medDosage} numberOfLines={1}>{d.dosage} · {d.time}</Text>
                      )) : (med.dosage ? <Text style={styles.medDosage} numberOfLines={1}>{(med as unknown as { dosage?: string }).dosage}</Text> : null)}
                    </View>
                    <Text style={[styles.medRefills, med.refillsRemaining <= 1 && styles.medRefillsLow]}>
                      {med.refillsRemaining === 0 ? "No refills" : `${med.refillsRemaining} refill${med.refillsRemaining === 1 ? "" : "s"} left`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingBottom: 16 },
    backBtn: { marginRight: 12, padding: 4 },
    title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
    emptyTitle: { fontWeight: "600", fontSize: 17, color: C.text, marginTop: 16 },
    emptyDesc: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginTop: 8, textAlign: "center" },
    card: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
    cardTitle: { fontWeight: "700", fontSize: 16, color: C.text, marginBottom: 12 },
    buttonRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
    actionBtnDisabled: { backgroundColor: C.surface, opacity: 0.7 },
    actionBtnText: { fontWeight: "600", fontSize: 13, color: C.tint },
    actionBtnTextDisabled: { color: C.textTertiary },
    medList: { gap: 10 },
    medRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.background, borderRadius: 10 },
    medName: { fontWeight: "600", fontSize: 14, color: C.text },
    medDosage: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 2 },
    medRefills: { fontWeight: "500", fontSize: 12, color: C.tint, marginLeft: 8 },
    medRefillsLow: { color: C.red },
  });
}

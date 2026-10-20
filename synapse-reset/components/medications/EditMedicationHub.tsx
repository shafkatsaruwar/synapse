import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { modalOverlay, modalSurface, modalSurfaceElevated } from "@/lib/modal-colors";
import type { GuidedStepId } from "@/lib/medication-draft";
import type { Medication } from "@/lib/storage";

type HubAction = { key: string; label: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; step?: GuidedStepId; advanced?: boolean };

export type EditMedicationHubProps = {
  visible: boolean;
  medication: Medication | null;
  onClose: () => void;
  onOpenGuided: (step: GuidedStepId) => void;
  onOpenAdvanced: () => void;
};

export default function EditMedicationHub({
  visible,
  medication,
  onClose,
  onOpenGuided,
  onOpenAdvanced,
}: EditMedicationHubProps) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const isPrn = (medication?.medicationType ?? "scheduled") === "prn";

  const actions: HubAction[] = [
    { key: "identity", label: "Name & photo", subtitle: "What this medication is called", icon: "medical-outline", step: "identity" },
    { key: "how", label: "Doses", subtitle: isPrn ? "Amount and how you take it" : "Amounts, units, and dose times", icon: "flask-outline", step: "how" },
    {
      key: "when",
      label: isPrn ? "Reminders" : "Schedule & reminders",
      subtitle: isPrn ? "As-needed medications don’t use a schedule" : "Repeat days and optional reminders",
      icon: "time-outline",
      step: isPrn ? "how" : "when",
    },
    { key: "advanced", label: "More details", subtitle: "Doctor, pharmacy, supply, sick-day protocol", icon: "options-outline", advanced: true },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">
            Edit {medication?.name?.trim() || "medication"}
          </Text>
          <Text style={styles.subtitle}>Choose what you’d like to change.</Text>
          {actions.map((action) => (
            <Pressable
              key={action.key}
              style={styles.row}
              onPress={() => {
                if (action.advanced) onOpenAdvanced();
                else if (action.step) onOpenGuided(action.step);
              }}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityHint={action.subtitle}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={action.icon} size={22} color={C.tint} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{action.label}</Text>
                <Text style={styles.rowSub}>{action.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
            </Pressable>
          ))}
          <Pressable style={styles.cancel} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: modalOverlay(),
    },
    sheet: {
      backgroundColor: modalSurface(C),
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    handle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: C.text,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 15,
      color: C.textSecondary,
      marginBottom: 16,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: modalSurfaceElevated(C),
      marginBottom: 10,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tintLight,
    },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 16, fontWeight: "600", color: C.text },
    rowSub: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
    cancel: {
      alignItems: "center",
      paddingVertical: 14,
      marginTop: 4,
    },
    cancelText: { fontSize: 16, fontWeight: "600", color: C.tint },
  });
}

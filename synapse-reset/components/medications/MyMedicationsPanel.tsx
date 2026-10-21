import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { raised } from "@/constants/raised";
import type { RegimenSummary } from "@/lib/medication-today";
import type { Medication } from "@/lib/storage";

export type MyMedicationsPanelProps = {
  regimens: RegimenSummary[];
  isCaregiver: boolean;
  caredForLabel?: string;
  onOpenMedication: (medication: Medication) => void;
  onLogPrn: (medication: Medication) => void;
  onManageMedication: (medication: Medication) => void;
};

export default function MyMedicationsPanel({
  regimens,
  isCaregiver,
  caredForLabel = "Care recipient",
  onOpenMedication,
  onLogPrn,
  onManageMedication,
}: MyMedicationsPanelProps) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const scheduled = regimens.filter((r) => !r.isPrn);
  const prn = regimens.filter((r) => r.isPrn);

  if (regimens.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="medkit-outline" size={36} color={C.textTertiary} />
        <Text style={styles.emptyTitle}>No medications yet</Text>
        <Text style={styles.emptyDesc}>Add a medication to track doses and reminders.</Text>
      </View>
    );
  }

  return (
    <View>
      {scheduled.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scheduled</Text>
          {scheduled.map(({ medication, doseSummary, takenToday, expectedToday, scheduledToday }) => (
            <Pressable
              key={medication.id}
              style={styles.card}
              onPress={() => onOpenMedication(medication)}
              accessibilityRole="button"
              accessibilityLabel={`${medication.name}. ${doseSummary}`}
            >
              <View style={styles.cardBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {medication.emoji ? `${medication.emoji} ` : ""}
                  {medication.name}
                </Text>
                <Text style={styles.summary} numberOfLines={2}>
                  {doseSummary}
                </Text>
                {isCaregiver && medication.entryOwner === "care_recipient" ? (
                  <Text style={styles.owner}>{caredForLabel}</Text>
                ) : null}
                {scheduledToday ? (
                  <Text style={styles.todayProgress}>
                    Today {takenToday}/{expectedToday}
                  </Text>
                ) : (
                  <Text style={styles.notToday}>Not scheduled today</Text>
                )}
              </View>
              <Pressable
                style={styles.manageBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onManageMedication(medication);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Manage ${medication.name}`}
                hitSlop={8}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={C.textSecondary} />
              </Pressable>
              <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {prn.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>As needed</Text>
          <Text style={styles.sectionHint}>Log a dose when you take one — nothing is recorded automatically.</Text>
          {prn.map(({ medication, doseSummary, takenToday }) => (
            <View key={medication.id} style={styles.card}>
              <Pressable
                style={styles.cardBody}
                onPress={() => onOpenMedication(medication)}
                accessibilityRole="button"
                accessibilityLabel={`${medication.name}, as needed`}
              >
                <Text style={styles.name} numberOfLines={1}>
                  {medication.emoji ? `${medication.emoji} ` : ""}
                  {medication.name}
                </Text>
                <Text style={styles.summary} numberOfLines={2}>
                  {doseSummary || "As needed"}
                </Text>
                {takenToday > 0 ? (
                  <Text style={styles.todayProgress}>
                    Logged {takenToday} time{takenToday === 1 ? "" : "s"} today
                  </Text>
                ) : (
                  <Text style={styles.notToday}>Not logged today</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.prnBtn}
                onPress={() => onLogPrn(medication)}
                accessibilityRole="button"
                accessibilityLabel={`Log dose of ${medication.name}`}
              >
                <Text style={styles.prnBtnText}>Log</Text>
              </Pressable>
              <Pressable
                style={styles.manageBtn}
                onPress={() => onManageMedication(medication)}
                accessibilityRole="button"
                accessibilityLabel={`Manage ${medication.name}`}
                hitSlop={8}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={C.textSecondary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    section: { marginBottom: 22 },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: C.text,
      marginBottom: 6,
    },
    sectionHint: {
      fontSize: 13,
      color: C.textSecondary,
      marginBottom: 10,
      lineHeight: 18,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: C.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      marginBottom: 8,
      gap: 8,
      ...raised("sm"),
    },
    cardBody: { flex: 1, minWidth: 0 },
    name: {
      fontSize: 16,
      fontWeight: "700",
      color: C.text,
    },
    summary: {
      fontSize: 13,
      color: C.textSecondary,
      marginTop: 3,
      lineHeight: 18,
    },
    owner: {
      fontSize: 12,
      color: C.tint,
      fontWeight: "600",
      marginTop: 3,
    },
    todayProgress: {
      fontSize: 12,
      fontWeight: "600",
      color: C.textSecondary,
      marginTop: 4,
    },
    notToday: {
      fontSize: 12,
      color: C.textTertiary,
      marginTop: 4,
    },
    manageBtn: {
      padding: 6,
    },
    prnBtn: {
      backgroundColor: C.tint,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    prnBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    emptyWrap: {
      alignItems: "center",
      paddingVertical: 36,
      paddingHorizontal: 24,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: C.text,
      textAlign: "center",
    },
    emptyDesc: {
      fontSize: 14,
      color: C.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
  });
}

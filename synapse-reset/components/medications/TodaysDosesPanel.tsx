import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { raised } from "@/constants/raised";
import {
  formatDoseAmountLabel,
  formatReminderClock,
  type TodayDoseBuckets,
  type TodayDoseInstance,
} from "@/lib/medication-today";

export type TodaysDosesPanelProps = {
  buckets: TodayDoseBuckets;
  isCaregiver: boolean;
  caredForLabel?: string;
  onToggleDose: (medicationId: string, doseIndex: number) => void;
  onOpenMedication: (medicationId: string) => void;
  undoToast?: { key: string; label: string } | null;
  onUndo?: () => void;
  onDismissUndo?: () => void;
};

function DoseCard({
  dose,
  styles,
  C,
  ownerLabel,
  onToggle,
  onOpen,
}: {
  dose: TodayDoseInstance;
  styles: ReturnType<typeof makeStyles>;
  C: Theme;
  ownerLabel?: string;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const amount = formatDoseAmountLabel(dose.amount, dose.unit);
  const when = formatReminderClock(dose.reminderTime, dose.timeOfDay);
  const isCompleted = dose.state === "completed";
  const needsAction = dose.state === "needs_attention";

  return (
    <Pressable
      style={[styles.card, isCompleted && styles.cardCompleted]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${dose.medicationName}, ${amount || "dose"}, ${when}${isCompleted ? ", taken" : needsAction ? ", needs attention" : ", upcoming"}`}
    >
      <View style={styles.cardMain}>
        <View style={styles.cardText}>
          <Text style={styles.cardName} numberOfLines={1}>
            {dose.emoji ? `${dose.emoji} ` : ""}
            {dose.medicationName}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {[amount, when].filter(Boolean).join(" · ")}
          </Text>
          {ownerLabel ? <Text style={styles.owner}>{ownerLabel}</Text> : null}
        </View>
        {isCompleted ? (
          <Pressable
            style={styles.takenChip}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggle();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Undo taken for ${dose.medicationName}`}
            hitSlop={8}
          >
            <Ionicons name="checkmark-circle" size={18} color={C.green} />
            <Text style={styles.takenChipText}>Taken</Text>
          </Pressable>
        ) : needsAction ? (
          <Pressable
            style={styles.takeBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggle();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${dose.medicationName} dose as taken`}
            hitSlop={4}
          >
            <Text style={styles.takeBtnText}>Taken</Text>
          </Pressable>
        ) : (
          <View style={styles.upcomingChip}>
            <Text style={styles.upcomingChipText}>{when}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function Section({
  title,
  count,
  children,
  styles,
  empty,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
  empty?: string;
}) {
  if (count === 0 && !empty) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
      {count === 0 ? <Text style={styles.emptySection}>{empty}</Text> : children}
    </View>
  );
}

export default function TodaysDosesPanel({
  buckets,
  isCaregiver,
  caredForLabel = "Care recipient",
  onToggleDose,
  onOpenMedication,
  undoToast,
  onUndo,
  onDismissUndo,
}: TodaysDosesPanelProps) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const ownerFor = (dose: TodayDoseInstance) =>
    isCaregiver && dose.entryOwner === "care_recipient" ? caredForLabel : undefined;

  if (buckets.total === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="medical-outline" size={36} color={C.textTertiary} />
        <Text style={styles.emptyTitle}>No doses scheduled today</Text>
        <Text style={styles.emptyDesc}>Weekly and custom medications only appear on their scheduled days.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.progress}>
        {buckets.takenCount} of {buckets.total} taken today
      </Text>

      <Section title="Needs attention" count={buckets.needsAttention.length} styles={styles} empty="You're caught up on due doses.">
        {buckets.needsAttention.map((dose) => (
          <DoseCard
            key={dose.key}
            dose={dose}
            styles={styles}
            C={C}
            ownerLabel={ownerFor(dose)}
            onToggle={() => onToggleDose(dose.medicationId, dose.doseIndex)}
            onOpen={() => onOpenMedication(dose.medicationId)}
          />
        ))}
      </Section>

      <Section title="Upcoming" count={buckets.upcoming.length} styles={styles}>
        {buckets.upcoming.map((dose) => (
          <DoseCard
            key={dose.key}
            dose={dose}
            styles={styles}
            C={C}
            ownerLabel={ownerFor(dose)}
            onToggle={() => onToggleDose(dose.medicationId, dose.doseIndex)}
            onOpen={() => onOpenMedication(dose.medicationId)}
          />
        ))}
      </Section>

      <Section title="Completed" count={buckets.completed.length} styles={styles}>
        {buckets.completed.map((dose) => (
          <DoseCard
            key={dose.key}
            dose={dose}
            styles={styles}
            C={C}
            ownerLabel={ownerFor(dose)}
            onToggle={() => onToggleDose(dose.medicationId, dose.doseIndex)}
            onOpen={() => onOpenMedication(dose.medicationId)}
          />
        ))}
      </Section>

      {undoToast ? (
        <View style={styles.undoBar} accessibilityLiveRegion="polite">
          <Text style={styles.undoText} numberOfLines={1}>
            {undoToast.label}
          </Text>
          <Pressable onPress={onUndo} accessibilityRole="button" accessibilityLabel="Undo">
            <Text style={styles.undoAction}>Undo</Text>
          </Pressable>
          <Pressable onPress={onDismissUndo} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8}>
            <Ionicons name="close" size={18} color={C.textSecondary} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    progress: {
      fontSize: 14,
      fontWeight: "600",
      color: C.textSecondary,
      marginBottom: 14,
    },
    section: { marginBottom: 20 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: C.text,
    },
    sectionCount: {
      fontSize: 13,
      fontWeight: "600",
      color: C.textTertiary,
    },
    emptySection: {
      fontSize: 14,
      color: C.textSecondary,
      paddingVertical: 6,
    },
    card: {
      backgroundColor: C.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 8,
      ...raised("sm"),
    },
    cardCompleted: {
      opacity: 0.85,
    },
    cardMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    cardText: { flex: 1, minWidth: 0 },
    cardName: {
      fontSize: 16,
      fontWeight: "700",
      color: C.text,
    },
    cardMeta: {
      fontSize: 13,
      color: C.textSecondary,
      marginTop: 2,
    },
    owner: {
      fontSize: 12,
      color: C.tint,
      marginTop: 3,
      fontWeight: "600",
    },
    takeBtn: {
      backgroundColor: C.tint,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    takeBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    takenChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: C.greenLight ?? C.surfaceElevated,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    takenChipText: {
      color: C.green,
      fontWeight: "700",
      fontSize: 13,
    },
    upcomingChip: {
      backgroundColor: C.surfaceElevated,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    upcomingChipText: {
      color: C.textSecondary,
      fontWeight: "600",
      fontSize: 12,
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
    undoBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: C.surfaceElevated,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginTop: 8,
      ...raised("sm"),
    },
    undoText: {
      flex: 1,
      fontSize: 14,
      color: C.text,
      fontWeight: "600",
    },
    undoAction: {
      fontSize: 14,
      fontWeight: "800",
      color: C.tint,
    },
  });
}

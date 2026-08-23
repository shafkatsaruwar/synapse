import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  getActiveDueEvent,
  getEnforcementMetrics,
  isMedicationEnforcementActive,
  resolveDoseEvent,
  snoozeDoseEvent,
} from "@/lib/med-enforcement";
import { DEFAULT_ENFORCEMENT_SNOOZE_MIN } from "@/constants/med-enforcement-copy";
import type { EnforcementMetrics, MedicationEnforcementEvent } from "@/lib/med-enforcement-core";
import type { Medication } from "@/lib/storage";

type DueState = { event: MedicationEnforcementEvent; medication: Medication | null; instructions: string };
type Mode = "view" | "skip" | "unable";

/**
 * Private Medication Enforcement resolution + metrics surface. Renders nothing
 * unless the feature is active (both the compile-time flag and the persisted
 * setting). Opening the app or this card never counts as taken — only the
 * explicit TAKEN button records a taken dose.
 */
export default function MedicationEnforcementCard({ onResolved }: { onResolved?: () => void }) {
  const { colors: C } = useTheme();
  const styles = makeStyles(C);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [due, setDue] = useState<DueState | null>(null);
  const [metrics, setMetrics] = useState<EnforcementMetrics | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const isActive = await isMedicationEnforcementActive();
    setActive(isActive);
    if (!isActive) {
      setReady(true);
      return;
    }
    const [dueEvent, m] = await Promise.all([getActiveDueEvent(), getEnforcementMetrics(30)]);
    setDue(dueEvent);
    setMetrics(m);
    setMode("view");
    setReason("");
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const afterChange = useCallback(async () => {
    await refresh();
    onResolved?.();
  }, [refresh, onResolved]);

  const onTaken = useCallback(async () => {
    if (!due || busy) return;
    setBusy(true);
    try {
      await resolveDoseEvent(due.event.id, "TAKEN", { medicationId: due.event.medicationId, doseIndex: due.event.doseIndex });
      await afterChange();
    } finally {
      setBusy(false);
    }
  }, [due, busy, afterChange]);

  const onSnooze = useCallback(async () => {
    if (!due || busy) return;
    setBusy(true);
    try {
      await snoozeDoseEvent(due.event.id, DEFAULT_ENFORCEMENT_SNOOZE_MIN, {
        medicationId: due.event.medicationId,
        doseIndex: due.event.doseIndex,
        medicationName: due.medication?.name,
      });
      await afterChange();
    } finally {
      setBusy(false);
    }
  }, [due, busy, afterChange]);

  const onResolveWithReason = useCallback(
    async (resolution: "SKIPPED" | "UNABLE_TO_TAKE") => {
      if (!due || busy) return;
      setBusy(true);
      try {
        await resolveDoseEvent(due.event.id, resolution, {
          reason: reason.trim() || undefined,
          medicationId: due.event.medicationId,
          doseIndex: due.event.doseIndex,
        });
        await afterChange();
      } finally {
        setBusy(false);
      }
    },
    [due, busy, reason, afterChange],
  );

  if (!ready || !active) return null;

  // No dose currently waiting: show the compact private 30-day metrics.
  if (!due) {
    if (!metrics || metrics.scheduledOccurrences === 0) return null;
    return (
      <View style={styles.metricsCard}>
        <Text style={styles.metricsTitle}>Enforcement · last 30 days</Text>
        <View style={styles.metricsRow}>
          <Metric label="Taken" value={String(metrics.confirmedTaken)} styles={styles} />
          <Metric label="Skipped" value={String(metrics.skipped)} styles={styles} />
          <Metric label="Can't take" value={String(metrics.unableToTake)} styles={styles} />
          <Metric label="Unresolved" value={String(metrics.unresolvedOrMissed)} styles={styles} />
        </View>
        <View style={styles.metricsRow}>
          <Metric label="Avg delay" value={metrics.averageResponseDelayMinutes != null ? `${metrics.averageResponseDelayMinutes}m` : "—"} styles={styles} />
          <Metric label="Snoozes" value={String(metrics.totalSnoozes)} styles={styles} />
          <Metric label="Max level" value={String(metrics.highestEscalationLevelReached)} styles={styles} />
          <Metric label="Occurrences" value={String(metrics.scheduledOccurrences)} styles={styles} />
        </View>
      </View>
    );
  }

  const scheduled = new Date(due.event.scheduledAt);
  const scheduledLabel = scheduled.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const waitingMin = Math.max(0, Math.round((Date.now() - scheduled.getTime()) / 60000));

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>MEDICATION DUE</Text>
      <Text style={styles.medName}>{due.medication?.name ?? "Medication"}</Text>
      <Text style={styles.meta}>Scheduled: {scheduledLabel}</Text>
      {!!due.instructions && <Text style={styles.meta}>{due.instructions}</Text>}
      <Text style={styles.waiting}>Waiting: {waitingMin} min</Text>

      {mode === "view" ? (
        <>
          <Pressable style={[styles.takenBtn, busy && styles.disabled]} onPress={onTaken} disabled={busy} accessibilityRole="button" accessibilityLabel="Mark medication taken">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.takenText}>TAKEN</Text>}
          </Pressable>
          <View style={styles.secondaryRow}>
            <Pressable style={styles.secondaryBtn} onPress={onSnooze} disabled={busy}>
              <Text style={styles.secondaryText}>Snooze</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => setMode("unable")} disabled={busy}>
              <Text style={styles.secondaryText}>Can&apos;t take</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => setMode("skip")} disabled={busy}>
              <Text style={styles.secondaryText}>Skip</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.reasonWrap}>
          <Text style={styles.reasonLabel}>{mode === "skip" ? "Skip — optional reason" : "Can't take — optional reason"}</Text>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder={mode === "unable" ? "e.g. not at home, unavailable" : "Optional note"}
            placeholderTextColor={C.textTertiary}
          />
          <View style={styles.secondaryRow}>
            <Pressable style={styles.secondaryBtn} onPress={() => { setMode("view"); setReason(""); }} disabled={busy}>
              <Text style={styles.secondaryText}>Back</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, busy && styles.disabled]}
              onPress={() => onResolveWithReason(mode === "skip" ? "SKIPPED" : "UNABLE_TO_TAKE")}
              disabled={busy}
            >
              <Text style={styles.confirmText}>{mode === "skip" ? "Confirm Skip" : "Confirm"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function Metric({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    card: { borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 16, marginBottom: 16 },
    eyebrow: { fontWeight: "800", fontSize: 11, letterSpacing: 0.6, color: C.textSecondary, textTransform: "uppercase" },
    medName: { fontSize: 20, fontWeight: "900", color: C.text, marginTop: 6 },
    meta: { fontSize: 13, fontWeight: "600", color: C.textSecondary, marginTop: 2 },
    waiting: { fontSize: 13, fontWeight: "700", color: C.textSecondary, marginTop: 6, marginBottom: 12 },
    takenBtn: { minHeight: 50, borderRadius: 14, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
    takenText: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },
    secondaryRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    secondaryBtn: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
    secondaryText: { color: C.text, fontWeight: "700", fontSize: 13 },
    confirmBtn: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
    confirmText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    disabled: { opacity: 0.6 },
    reasonWrap: { marginTop: 4 },
    reasonLabel: { fontSize: 12, fontWeight: "700", color: C.textSecondary, marginBottom: 6 },
    reasonInput: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated, paddingHorizontal: 12, color: C.text, fontSize: 14 },
    metricsCard: { borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated, padding: 14, marginBottom: 16 },
    metricsTitle: { fontSize: 12, fontWeight: "800", color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
    metricsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    metric: { flex: 1, alignItems: "center" },
    metricValue: { fontSize: 18, fontWeight: "900", color: C.text },
    metricLabel: { fontSize: 10, fontWeight: "600", color: C.textSecondary, marginTop: 2, textAlign: "center" },
  });
}

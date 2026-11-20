import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import SoftCard from "@/components/SoftCard";
import RetainerCareConfirmModal from "@/components/RetainerCareConfirmModal";
import { RETAINER_ROUTINE_LABEL } from "@/constants/retainer-care-copy";
import { featureFlags } from "@/constants/feature-flags";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  beginRetainerConfirm,
  confirmRetainersNotYet,
  confirmRetainersYes,
  consumePendingRetainerConfirm,
  getRetainerCareSnapshot,
  pauseRetainerCareTonight,
  removedForSnack,
  reportRetainersHurt,
  skipRetainerCareTonight,
  snoozeRetainerCare,
  updateRetainerSettings,
} from "@/lib/retainer-care";
import type { RetainerOccurrence, RetainerStatusView } from "@/lib/retainer-care-core";

type Props = {
  /** Shell owns the back control; kept for route wiring consistency. */
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
  refreshKey?: number;
};

const STATUS_COPY: Record<RetainerStatusView, { title: string; detail: string }> = {
  retainers_in: { title: "Retainers in", detail: "Tonight’s routine is complete." },
  retainers_out: { title: "Retainers out", detail: "Marked removed for a snack — waiting for reinsertion." },
  confirmation_pending: { title: "Confirmation pending", detail: "Tonight’s check is still open." },
  paused: { title: "Paused", detail: "Follow-ups are paused for tonight." },
  completed_tonight: { title: "Completed for tonight", detail: "You confirmed both retainers are in." },
  skipped: { title: "Skipped", detail: "Not tonight — no more follow-ups for this night." },
  pain_stopped: {
    title: "Fit issue recorded",
    detail: "Enforcement stopped. Don’t force painful retainers — contact your orthodontist if needed.",
  },
  scheduled: { title: "Scheduled", detail: "Bedtime reminder is set for later tonight." },
};

function formatWhen(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function RetainerCareScreen({ onNavigate, refreshKey }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [statusView, setStatusView] = useState<RetainerStatusView>("scheduled");
  const [occurrence, setOccurrence] = useState<RetainerOccurrence | null>(null);
  const [nextFollowUpAt, setNextFollowUpAt] = useState<string | null>(null);
  const [recent, setRecent] = useState<RetainerOccurrence[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const topPad = isWide ? 28 : Platform.OS === "web" ? 40 : 14;
  const bottomPad = isWide ? 40 : Platform.OS === "web" ? 118 : insets.bottom + 100;

  const load = useCallback(async () => {
    if (!featureFlags.retainerCareEnabled) {
      setReady(true);
      setActive(false);
      return;
    }
    const snap = await getRetainerCareSnapshot();
    setActive(snap.active);
    setStatusView(snap.statusView);
    setOccurrence(snap.occurrence);
    setNextFollowUpAt(snap.nextFollowUpAt);
    setRecent(snap.recent);
    setReady(true);
    if (consumePendingRetainerConfirm()) {
      setConfirmOpen(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => sub.remove();
  }, [load]);

  const after = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await load();
  };

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await after();
    } finally {
      setBusy(false);
    }
  };

  const openConfirm = async () => {
    await beginRetainerConfirm();
    setConfirmOpen(true);
  };

  if (!ready) {
    return <View style={styles.root} />;
  }

  if (!featureFlags.retainerCareEnabled) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}
      >
        <Text style={styles.title}>Retainer Care</Text>
        <Text style={styles.meta}>This personal module is turned off in this build.</Text>
      </ScrollView>
    );
  }

  const status = STATUS_COPY[statusView];
  const openStates =
    statusView === "confirmation_pending" ||
    statusView === "scheduled" ||
    statusView === "retainers_out";

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Retainer Care</Text>
          <Pressable
            style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.8 }]}
            onPress={() => onNavigate?.("retainercaresettings")}
            accessibilityRole="button"
            accessibilityLabel="Retainer settings"
            hitSlop={12}
          >
            <Ionicons name="settings-outline" size={22} color={C.tint} />
          </Pressable>
        </View>

        <SoftCard style={styles.card}>
          <Text style={styles.routine}>{RETAINER_ROUTINE_LABEL}</Text>
          <Text style={styles.statusTitle}>{status.title}</Text>
          <Text style={styles.statusDetail}>{status.detail}</Text>
          {occurrence?.confirmedAt ? (
            <Text style={styles.meta}>Last confirmed: {formatWhen(occurrence.confirmedAt)}</Text>
          ) : null}
          {nextFollowUpAt && openStates ? (
            <Text style={styles.meta}>Next check: {formatWhen(nextFollowUpAt)}</Text>
          ) : null}
          {!active ? (
            <View style={{ gap: 10, marginTop: 8 }}>
              <Text style={styles.meta}>Retainer Care is off. Turn it on to schedule tonight’s check.</Text>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => void run(() => updateRetainerSettings({ enabled: true }))}
              >
                <Text style={styles.primaryBtnText}>Enable for me</Text>
              </Pressable>
            </View>
          ) : null}
        </SoftCard>

        {active ? (
          <SoftCard style={styles.card}>
            <Text style={styles.cardTitle}>Tonight</Text>
            <Action
              label="Retainers are in"
              onPress={() => void openConfirm()}
              styles={styles}
              primary
              disabled={busy || statusView === "completed_tonight" || statusView === "pain_stopped"}
            />
            <Action
              label="Removed for snack"
              onPress={() => void run(() => removedForSnack())}
              styles={styles}
              disabled={busy}
            />
            <Action
              label="Remind me later"
              onPress={() => void run(() => snoozeRetainerCare())}
              styles={styles}
              disabled={busy || statusView === "completed_tonight" || statusView === "pain_stopped"}
            />
            <Action
              label="Pause for tonight"
              onPress={() => void run(() => pauseRetainerCareTonight())}
              styles={styles}
              disabled={busy || statusView === "paused"}
            />
            <Action
              label="Not tonight"
              onPress={() =>
                Alert.alert("Skip tonight?", "No more retainer follow-ups for this night.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Skip", style: "destructive", onPress: () => void run(() => skipRetainerCareTonight()) },
                ])
              }
              styles={styles}
              disabled={busy || statusView === "skipped"}
            />
          </SoftCard>
        ) : null}

        <SoftCard style={styles.card}>
          <Text style={styles.cardTitle}>Recent nights</Text>
          {recent.length === 0 ? (
            <Text style={styles.meta}>No history yet.</Text>
          ) : (
            recent.slice(0, 10).map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <Text style={styles.historyNight}>{item.nightId}</Text>
                <Text style={styles.historyState}>{item.state.replace(/_/g, " ")}</Text>
              </View>
            ))
          )}
        </SoftCard>
      </ScrollView>

      <RetainerCareConfirmModal
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirmYes={() => {
          setConfirmOpen(false);
          void run(() => confirmRetainersYes());
        }}
        onNotYet={() => {
          setConfirmOpen(false);
          void run(() => confirmRetainersNotYet());
        }}
        onPain={() => {
          setConfirmOpen(false);
          Alert.alert(
            "Don’t force painful retainers",
            "Enforcement will stop for tonight. If they keep hurting or don’t fit, contact your orthodontist.",
            [{ text: "OK", onPress: () => void run(() => reportRetainersHurt()) }],
          );
        }}
      />
    </View>
  );
}

function Action({
  label,
  onPress,
  styles,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.actionBtn, primary ? styles.primaryBtn : null, disabled ? styles.disabled : null]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={primary ? styles.primaryBtnText : styles.actionBtnText}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 4,
    },
    title: { flex: 1, fontSize: 28, fontWeight: "700", color: C.text },
    settingsBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    content: { paddingHorizontal: 16, gap: 14 },
    card: { padding: 16, gap: 10 },
    routine: {
      fontSize: 13,
      fontWeight: "600",
      color: C.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    statusTitle: { fontSize: 22, fontWeight: "700", color: C.text },
    statusDetail: { fontSize: 15, lineHeight: 22, color: C.textSecondary },
    cardTitle: { fontSize: 17, fontWeight: "700", color: C.text, marginBottom: 2 },
    meta: { fontSize: 13, lineHeight: 18, color: C.textSecondary },
    actionBtn: {
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      backgroundColor: C.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    actionBtnText: { textAlign: "center", fontSize: 16, fontWeight: "600", color: C.text },
    primaryBtn: {
      backgroundColor: C.tint,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderWidth: 0,
    },
    primaryBtnText: { textAlign: "center", fontSize: 16, fontWeight: "600", color: "#fff" },
    disabled: { opacity: 0.45 },
    historyRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    historyNight: { fontSize: 14, color: C.text, fontWeight: "500" },
    historyState: { fontSize: 13, color: C.textSecondary, textTransform: "capitalize" },
  });
}

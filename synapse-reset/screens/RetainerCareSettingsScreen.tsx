import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import SoftCard from "@/components/SoftCard";
import { RETAINER_FIRM_ENFORCEMENT_EXPLAINER } from "@/constants/retainer-care-copy";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  enableRetainerNotifications,
  getRetainerNotificationPermission,
  getRetainerSettings,
  openSystemNotificationSettings,
  sendRetainerTestNotification,
  updateRetainerSettings,
  type RetainerPermissionState,
} from "@/lib/retainer-care";
import type { RetainerSettings } from "@/lib/retainer-care-core";

type Props = {
  /** Shell owns the back control; kept for route wiring consistency. */
  onBack?: () => void;
};

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function permissionLabel(state: RetainerPermissionState): string {
  switch (state) {
    case "granted":
      return "Allowed";
    case "denied":
      return "Off — open system Settings to allow";
    case "unavailable":
      return "Not available on this device";
    default:
      return "Not set up yet";
  }
}

export default function RetainerCareSettingsScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [settings, setSettings] = useState<RetainerSettings | null>(null);
  const [permission, setPermission] = useState<RetainerPermissionState>("undetermined");
  const [busy, setBusy] = useState(false);
  const [bedHour, setBedHour] = useState("23");
  const [bedMinute, setBedMinute] = useState("55");
  const [firstFollow, setFirstFollow] = useState("10");
  const [interval, setInterval] = useState("15");
  const [maxFollow, setMaxFollow] = useState("4");
  const [snackMin, setSnackMin] = useState("20");
  const [snoozeMin, setSnoozeMin] = useState("10");
  const [qhStartH, setQhStartH] = useState("");
  const [qhStartM, setQhStartM] = useState("");
  const [qhEndH, setQhEndH] = useState("");
  const [qhEndM, setQhEndM] = useState("");

  const topPad = isWide ? 28 : Platform.OS === "web" ? 40 : 14;
  const bottomPad = isWide ? 40 : Platform.OS === "web" ? 118 : insets.bottom + 100;

  const load = useCallback(async () => {
    const [s, perm] = await Promise.all([getRetainerSettings(), getRetainerNotificationPermission()]);
    setSettings(s);
    setPermission(perm);
    setBedHour(String(s.bedtimeHour));
    setBedMinute(String(s.bedtimeMinute).padStart(2, "0"));
    setFirstFollow(String(s.firstFollowUpMin));
    setInterval(String(s.followUpIntervalMin));
    setMaxFollow(String(s.maxFollowUps));
    setSnackMin(String(s.snackFollowUpMin));
    setSnoozeMin(String(s.snoozeMin));
    setQhStartH(s.quietHoursStartHour == null ? "" : String(s.quietHoursStartHour));
    setQhStartM(s.quietHoursStartMinute == null ? "" : String(s.quietHoursStartMinute).padStart(2, "0"));
    setQhEndH(s.quietHoursEndHour == null ? "" : String(s.quietHoursEndHour));
    setQhEndM(s.quietHoursEndMinute == null ? "" : String(s.quietHoursEndMinute).padStart(2, "0"));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => sub.remove();
  }, [load]);

  const persist = async (partial: Partial<RetainerSettings>) => {
    const next = await updateRetainerSettings(partial);
    setSettings(next);
    Haptics.selectionAsync();
  };

  const saveNumbers = async () => {
    if (!settings) return;
    const quietConfigured =
      qhStartH.trim() !== "" && qhStartM.trim() !== "" && qhEndH.trim() !== "" && qhEndM.trim() !== "";
    await persist({
      bedtimeHour: clampInt(bedHour, 0, 23, settings.bedtimeHour),
      bedtimeMinute: clampInt(bedMinute, 0, 59, settings.bedtimeMinute),
      firstFollowUpMin: clampInt(firstFollow, 1, 180, settings.firstFollowUpMin),
      followUpIntervalMin: clampInt(interval, 1, 180, settings.followUpIntervalMin),
      maxFollowUps: clampInt(maxFollow, 0, 8, settings.maxFollowUps),
      snackFollowUpMin: clampInt(snackMin, 5, 180, settings.snackFollowUpMin),
      snoozeMin: clampInt(snoozeMin, 5, 60, settings.snoozeMin),
      quietHoursStartHour: quietConfigured ? clampInt(qhStartH, 0, 23, 0) : null,
      quietHoursStartMinute: quietConfigured ? clampInt(qhStartM, 0, 59, 0) : null,
      quietHoursEndHour: quietConfigured ? clampInt(qhEndH, 0, 23, 0) : null,
      quietHoursEndMinute: quietConfigured ? clampInt(qhEndM, 0, 59, 0) : null,
    });
  };

  const onSetupNotifications = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (permission === "denied") {
        await openSystemNotificationSettings();
        return;
      }
      const result = await enableRetainerNotifications();
      setSettings(result.settings);
      setPermission(result.granted ? "granted" : await getRetainerNotificationPermission());
      Haptics.notificationAsync(
        result.granted
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
      if (!result.granted) {
        Alert.alert(
          "Notifications still off",
          "Synapse can’t schedule retainer alerts until notifications are allowed for this app.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => void openSystemNotificationSettings() },
          ],
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await sendRetainerTestNotification();
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Test scheduled", "You should see a Retainer Care test alert in a few seconds.");
      } else {
        Alert.alert("Couldn’t send test", "Allow notifications first, then try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!settings) {
    return <View style={styles.root} />;
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Retainer settings</Text>

      <SoftCard style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <Text style={styles.meta}>Status: {permissionLabel(permission)}</Text>
        <Pressable
          style={[styles.saveBtn, busy ? styles.disabled : null]}
          onPress={() => void onSetupNotifications()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={permission === "granted" ? "Refresh notification permission" : "Set up notifications"}
        >
          <Text style={styles.saveText}>
            {permission === "granted"
              ? "Notifications are on"
              : permission === "denied"
                ? "Open system Settings"
                : "Set up notifications"}
          </Text>
        </Pressable>
        <Row label="Persistent alerts" styles={styles}>
          <Switch
            value={settings.persistentAlerts !== false}
            onValueChange={(value) => void persist({ persistentAlerts: value })}
            accessibilityLabel="Persistent alerts"
          />
        </Row>
        <Text style={styles.meta}>
          Uses higher-priority delivery so alerts are harder to miss. On iOS, Focus breakthrough works best after a
          native build with Time Sensitive Notifications enabled.
        </Text>
        <Row label="Play sound" styles={styles}>
          <Switch
            value={settings.playSound !== false}
            onValueChange={(value) => void persist({ playSound: value })}
            accessibilityLabel="Play sound"
          />
        </Row>
        <Row label="Keep notifying until confirmed" styles={styles}>
          <Switch
            value={settings.enforcementEnabled}
            onValueChange={(value) => void persist({ enforcementEnabled: value })}
            accessibilityLabel="Keep notifying until confirmed"
          />
        </Row>
        <Text style={styles.meta}>
          Firm follow-ups continue on a schedule until you confirm, skip, pause, or report a fit issue.
        </Text>
        <Pressable
          style={[styles.secondaryBtn, busy ? styles.disabled : null]}
          onPress={() => void onTest()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Send test notification"
        >
          <Text style={styles.secondaryBtnText}>Send test notification</Text>
        </Pressable>
      </SoftCard>

      <SoftCard style={styles.card}>
        <Text style={styles.cardTitle}>Routine</Text>
        <Text style={styles.explainer}>{RETAINER_FIRM_ENFORCEMENT_EXPLAINER}</Text>
        <Row label="Enable Retainer Care" styles={styles}>
          <Switch
            value={settings.enabled}
            onValueChange={(value) => void persist({ enabled: value })}
            accessibilityLabel="Enable Retainer Care"
          />
        </Row>
      </SoftCard>

      <SoftCard style={styles.card}>
        <Text style={styles.cardTitle}>Timing</Text>
        <Field label="Bedtime hour (0–23)" value={bedHour} onChange={setBedHour} styles={styles} />
        <Field label="Bedtime minute (0–59)" value={bedMinute} onChange={setBedMinute} styles={styles} />
        <Field label="First follow-up (minutes)" value={firstFollow} onChange={setFirstFollow} styles={styles} />
        <Field label="Follow-up interval (minutes)" value={interval} onChange={setInterval} styles={styles} />
        <Field label="Maximum follow-ups" value={maxFollow} onChange={setMaxFollow} styles={styles} />
        <Field label="Snack follow-up (minutes)" value={snackMin} onChange={setSnackMin} styles={styles} />
        <Field label="Snooze (minutes)" value={snoozeMin} onChange={setSnoozeMin} styles={styles} />
        <Pressable style={styles.saveBtn} onPress={() => void saveNumbers()} accessibilityRole="button">
          <Text style={styles.saveText}>Save timing</Text>
        </Pressable>
      </SoftCard>

      <SoftCard style={styles.card}>
        <Text style={styles.cardTitle}>Quiet hours (optional)</Text>
        <Text style={styles.meta}>Leave blank to disable. Bedtime reminder still fires during quiet hours.</Text>
        <Field label="Start hour" value={qhStartH} onChange={setQhStartH} styles={styles} />
        <Field label="Start minute" value={qhStartM} onChange={setQhStartM} styles={styles} />
        <Field label="End hour" value={qhEndH} onChange={setQhEndH} styles={styles} />
        <Field label="End minute" value={qhEndM} onChange={setQhEndM} styles={styles} />
        <Pressable style={styles.saveBtn} onPress={() => void saveNumbers()} accessibilityRole="button">
          <Text style={styles.saveText}>Save quiet hours</Text>
        </Pressable>
      </SoftCard>
    </ScrollView>
  );
}

function Row({
  label,
  children,
  styles,
}: {
  label: string;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  styles,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    content: { paddingHorizontal: 16, gap: 14 },
    title: { fontSize: 28, fontWeight: "700", color: C.text, marginBottom: 4 },
    card: { padding: 16, gap: 12 },
    cardTitle: { fontSize: 17, fontWeight: "700", color: C.text },
    explainer: { fontSize: 14, lineHeight: 20, color: C.textSecondary },
    meta: { fontSize: 13, lineHeight: 18, color: C.textSecondary },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    rowLabel: { flex: 1, fontSize: 15, color: C.text, fontWeight: "500" },
    field: { gap: 6 },
    fieldLabel: { fontSize: 13, color: C.textSecondary, fontWeight: "500" },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: C.text,
      backgroundColor: C.surface,
    },
    saveBtn: {
      marginTop: 4,
      backgroundColor: C.tint,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    saveText: { color: "#fff", fontWeight: "600", fontSize: 15 },
    secondaryBtn: {
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: C.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    secondaryBtnText: { color: C.text, fontWeight: "600", fontSize: 15 },
    disabled: { opacity: 0.45 },
  });
}

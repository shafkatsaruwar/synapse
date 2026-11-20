import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import SoftCard from "@/components/SoftCard";
import { RETAINER_FIRM_ENFORCEMENT_EXPLAINER } from "@/constants/retainer-care-copy";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { getRetainerSettings, updateRetainerSettings } from "@/lib/retainer-care";
import type { RetainerSettings } from "@/lib/retainer-care-core";

type Props = {
  onBack: () => void;
};

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export default function RetainerCareSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [settings, setSettings] = useState<RetainerSettings | null>(null);
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

  const load = useCallback(async () => {
    const s = await getRetainerSettings();
    setSettings(s);
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

  if (!settings) {
    return <View style={[styles.root, { paddingTop: insets.top }]} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={C.tint} />
        </Pressable>
        <Text style={styles.headerTitle}>Retainer settings</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          <Row label="Firm follow-ups" styles={styles}>
            <Switch
              value={settings.enforcementEnabled}
              onValueChange={(value) => void persist({ enforcementEnabled: value })}
              accessibilityLabel="Firm follow-ups"
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
    </View>
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    headerTitle: { fontSize: 18, fontWeight: "700", color: C.text },
    content: { padding: 16, paddingBottom: 48, gap: 14 },
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
  });
}

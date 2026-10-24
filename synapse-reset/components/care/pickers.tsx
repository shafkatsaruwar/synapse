import React, { useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import TextInput from "@/components/DoneTextInput";
import { deviceTimeZone, formatInZone, isValidTimeZone, zoneShortName } from "@/lib/care/time-zone";
import { Pill, SecondaryButton, useCareStyles } from "./ui";

export const COMMON_TIME_ZONES: { id: string; label: string }[] = [
  { id: "America/New_York", label: "Boston, New York" },
  { id: "America/Chicago", label: "Chicago" },
  { id: "America/Denver", label: "Denver" },
  { id: "America/Los_Angeles", label: "Los Angeles" },
  { id: "America/Phoenix", label: "Phoenix" },
  { id: "America/Anchorage", label: "Anchorage" },
  { id: "Pacific/Honolulu", label: "Honolulu" },
  { id: "America/Toronto", label: "Toronto" },
  { id: "America/Sao_Paulo", label: "São Paulo" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Paris", label: "Paris, Berlin" },
  { id: "Europe/Istanbul", label: "Istanbul" },
  { id: "Africa/Cairo", label: "Cairo" },
  { id: "Africa/Lagos", label: "Lagos" },
  { id: "Asia/Dubai", label: "Dubai" },
  { id: "Asia/Karachi", label: "Karachi" },
  { id: "Asia/Kolkata", label: "Delhi, Mumbai" },
  { id: "Asia/Dhaka", label: "Dhaka" },
  { id: "Asia/Bangkok", label: "Bangkok" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Asia/Tokyo", label: "Tokyo" },
  { id: "Australia/Sydney", label: "Sydney" },
  { id: "Pacific/Auckland", label: "Auckland" },
];

export function zoneLabel(id: string): string {
  const known = COMMON_TIME_ZONES.find((z) => z.id === id)?.label;
  return known ? `${known} (${id})` : id;
}

/** Row that opens a list of IANA zones. Shows the current local time there so the gap is obvious. */
export function TimeZoneField({ value, onChange, label = "Time zone" }: { value: string; onChange: (tz: string) => void; label?: string }) {
  const s = useCareStyles();
  const { colors: C } = useTheme();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const now = Date.now();
  const options = useMemo(() => {
    const device = deviceTimeZone();
    const list = [{ id: device, label: "This iPhone's current zone" }, ...COMMON_TIME_ZONES.filter((z) => z.id !== device)];
    if (!list.some((z) => z.id === value) && isValidTimeZone(value)) list.unshift({ id: value, label: value });
    return list;
  }, [value]);

  return (
    <>
      <Pressable style={({ pressed }) => [styles.field, { borderColor: C.border, backgroundColor: C.surfaceElevated }, pressed && { opacity: 0.7 }]} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${zoneLabel(value)}`}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowSub}>{label}</Text>
          <Text style={s.rowTitle}>{zoneLabel(value)}</Text>
          <Text style={s.rowSub}>
            Now {formatInZone(now, value, { weekday: "short", hour: "numeric", minute: "2-digit" })} {zoneShortName(now, value)}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={C.textTertiary} />
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: C.background, padding: 20 }}>
          <Text style={s.title}>{label}</Text>
          <Text style={s.subtitle}>Synapse follows daylight saving changes for you.</Text>
          <ScrollView style={{ marginTop: 12 }} keyboardShouldPersistTaps="handled">
            {options.map((z) => (
              <Pressable key={z.id} style={({ pressed }) => [styles.option, { borderColor: C.border }, pressed && { opacity: 0.7 }]} onPress={() => { onChange(z.id); setOpen(false); }} accessibilityRole="button" accessibilityLabel={`${z.label}, ${z.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{z.label}</Text>
                  <Text style={s.rowSub}>
                    {z.id} · {formatInZone(now, z.id, { hour: "numeric", minute: "2-digit" })} {zoneShortName(now, z.id)}
                  </Text>
                </View>
                {z.id === value ? <Ionicons name="checkmark-circle" size={22} color={C.tint} /> : null}
              </Pressable>
            ))}
            <View style={{ marginTop: 16, gap: 8 }}>
              <Text style={s.rowSub}>Somewhere else? Type an identifier like Asia/Manila</Text>
              <TextInput value={custom} onChangeText={(t) => { setCustom(t); setError(""); }} placeholder="Region/City" autoCapitalize="none" autoCorrect={false} style={[styles.input, { borderColor: C.border, color: C.text }]} accessibilityLabel="Custom time zone" />
              {error ? <Text style={{ color: C.red, fontSize: 13 }}>{error}</Text> : null}
              <SecondaryButton label="Use this zone" onPress={() => { const t = custom.trim(); if (isValidTimeZone(t)) { onChange(t); setOpen(false); } else setError("That isn't a valid time zone identifier."); }} disabled={!custom.trim()} />
            </View>
          </ScrollView>
          <SecondaryButton label="Close" onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </>
  );
}

function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function dateToHhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatHhmm(hhmm: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(hhmmToDate(hhmm));
}

/** Time-of-day picker using the native iOS control. Values are plain HH:MM strings. */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (hhmm: string) => void }) {
  const s = useCareStyles();
  const { colors: C } = useTheme();
  const [show, setShow] = useState(Platform.OS === "ios");
  return (
    <View style={[styles.field, { borderColor: C.border, backgroundColor: C.surfaceElevated }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{label}</Text>
        {Platform.OS !== "ios" ? <Text style={s.rowSub}>{formatHhmm(value)}</Text> : null}
      </View>
      {Platform.OS !== "ios" && !show ? <Pill label="Change" /> : null}
      {show || Platform.OS === "ios" ? (
        <DateTimePicker value={hhmmToDate(value)} mode="time" display="compact" onChange={(_, d) => { if (Platform.OS !== "ios") setShow(false); if (d) onChange(dateToHhmm(d)); }} accessibilityLabel={label} />
      ) : (
        <Pressable onPress={() => setShow(true)} accessibilityRole="button" accessibilityLabel={`Change ${label}`}>
          <Text style={{ color: C.tint, fontWeight: "700" }}>Change</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ChipRow<T extends string | number>({ options, value, onChange, format }: { options: readonly T[]; value: T; onChange: (v: T) => void; format?: (v: T) => string }) {
  const { colors: C } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={String(o)} onPress={() => onChange(o)} style={[styles.chip, { borderColor: on ? C.text : C.border, backgroundColor: on ? C.surfaceElevated : C.surface }]} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={format ? format(o) : String(o)}>
            <Text style={{ fontWeight: "700", fontSize: 13, color: on ? C.text : C.textSecondary }}>{format ? format(o) : String(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, minHeight: 52 },
  option: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 52 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, minHeight: 44, justifyContent: "center" },
});

/** Their preferred contact window. Set by a person, never inferred. */
export function ContactHoursEditor({ value, onChange }: { value: { start: string; end: string } | null; onChange: (v: { start: string; end: string } | null) => void }) {
  const s = useCareStyles();
  const v = value ?? { start: "09:00", end: "20:00" };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>Preferred contact hours</Text>
          <Text style={s.rowSub}>Only if you know them. Never guessed from location.</Text>
        </View>
        <Switch value={!!value} onValueChange={(on) => onChange(on ? v : null)} accessibilityLabel="Preferred contact hours" />
      </View>
      {value ? (
        <>
          <TimeField label="From" value={v.start} onChange={(t) => onChange({ ...v, start: t })} />
          <TimeField label="Until" value={v.end} onChange={(t) => onChange({ ...v, end: t })} />
        </>
      ) : null}
    </View>
  );
}

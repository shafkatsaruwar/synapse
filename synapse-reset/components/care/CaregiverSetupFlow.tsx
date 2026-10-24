import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useCareProfiles } from "@/contexts/CareProfileContext";
import TextInput from "@/components/DoneTextInput";
import { Body, Notice, PrimaryButton, SecondaryButton } from "./ui";
import { TimeZoneField } from "./pickers";
import { deviceTimeZone } from "@/lib/care/time-zone";
import type { LocalCareProfile } from "@/lib/care/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called after an on-device profile was created. */
  onCreated?: (profile: LocalCareProfile) => void;
  /** Called when the person picks "Connect With Their Synapse". */
  onConnect?: (profile?: LocalCareProfile) => void;
};

function ageFromDob(dob: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  let age = now.getFullYear() - Number(m[1]);
  if (now.getMonth() + 1 < Number(m[2]) || (now.getMonth() + 1 === Number(m[2]) && now.getDate() < Number(m[3]))) age -= 1;
  return age;
}

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "Set up caregiver mode": details first, then how to manage their care. */
export default function CaregiverSetupFlow({ visible, onClose, onCreated, onConnect }: Props) {
  const { colors: C } = useTheme();
  const { createProfile } = useCareProfiles();
  const [step, setStep] = useState<"details" | "method">("details");
  const [name, setName] = useState("");
  const [useDob, setUseDob] = useState(false);
  const [dob, setDob] = useState<Date | null>(null);
  const [age, setAge] = useState("");
  const [relation, setRelation] = useState("");
  const [guardian, setGuardian] = useState(false);
  const [tz, setTz] = useState(deviceTimeZone());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setStep("details");
      setName("");
      setUseDob(false);
      setDob(null);
      setAge("");
      setRelation("");
      setGuardian(false);
      setTz(deviceTimeZone());
      setError("");
    }
  }, [visible]);

  const ageNumber = useDob && dob ? ageFromDob(toIso(dob)) : age.trim() ? parseInt(age, 10) : null;
  const isMinor = ageNumber !== null && Number.isFinite(ageNumber) && ageNumber < 18;
  const maxDob = useMemo(() => new Date(), []);

  const next = () => {
    if (!name.trim()) {
      setError("Add their name to continue.");
      return;
    }
    if (!useDob && age.trim() && (!/^\d{1,3}$/.test(age.trim()) || parseInt(age, 10) > 120)) {
      setError("Enter a realistic age, or leave it blank.");
      return;
    }
    setError("");
    setStep("method");
  };

  const make = async (): Promise<LocalCareProfile> =>
    createProfile({
      type: "caregiver_managed",
      displayName: name.trim(),
      dateOfBirth: useDob && dob ? toIso(dob) : undefined,
      legacyAge: !useDob && age.trim() ? parseInt(age, 10) : undefined,
      relationship: relation.trim() || undefined,
      guardianClaim: isMinor && guardian ? "self_declared" : "none",
      timeZone: tz,
      medScheduleTimeZone: tz,
    });

  const onThisPhone = async () => {
    setBusy(true);
    try {
      const p = await make();
      onCreated?.(p);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const onConnectPress = async () => {
    setBusy(true);
    try {
      const p = await make();
      onConnect?.(p);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 22, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            {step === "method" ? (
              <Pressable onPress={() => setStep("details")} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="chevron-back" size={22} color={C.tint} />
              </Pressable>
            ) : <View style={styles.iconBtn} />}
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color={C.textSecondary} />
            </Pressable>
          </View>

          {step === "details" ? (
            <>
              <Text style={[styles.title, { color: C.text }]} accessibilityRole="header">Set up caregiver mode</Text>
              <Text style={[styles.prompt, { color: C.textSecondary }]}>Who are you managing care for?</Text>
              <TextInput value={name} onChangeText={(t) => { setName(t); setError(""); }} placeholder="Name" placeholderTextColor={C.textTertiary} style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]} accessibilityLabel="Name" autoCapitalize="words" textContentType="name" />
              {useDob ? (
                <View style={[styles.input, { borderColor: C.border, backgroundColor: C.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                  <Text style={{ color: C.text, fontSize: 16 }}>Date of birth</Text>
                  <DateTimePicker value={dob ?? new Date(2000, 0, 1)} mode="date" display="compact" maximumDate={maxDob} onChange={(_, d) => d && setDob(d)} accessibilityLabel="Date of birth" />
                </View>
              ) : (
                <TextInput value={age} onChangeText={(t) => { setAge(t); setError(""); }} placeholder="Age" placeholderTextColor={C.textTertiary} keyboardType="number-pad" style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]} accessibilityLabel="Age" />
              )}
              <Pressable onPress={() => { setUseDob((v) => !v); setError(""); }} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
                <Text style={{ color: C.tint, fontWeight: "700" }}>{useDob ? "Use age instead" : "Use date of birth instead"}</Text>
              </Pressable>
              <TextInput value={relation} onChangeText={setRelation} placeholder="Relationship (optional)" placeholderTextColor={C.textTertiary} style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]} accessibilityLabel="Relationship, optional" />
              <TimeZoneField value={tz} onChange={setTz} label="Where they live" />
              {isMinor ? (
                <View style={{ gap: 8 }}>
                  <View style={[styles.input, { borderColor: C.border, backgroundColor: C.surface, flexDirection: "row", alignItems: "center", gap: 10 }]}>
                    <Text style={{ flex: 1, color: C.text, fontSize: 15 }}>I'm their parent or legal guardian</Text>
                    <Switch value={guardian} onValueChange={setGuardian} accessibilityLabel="I am their parent or legal guardian" />
                  </View>
                  <Notice icon="shield-outline">This is your own statement. Synapse can't verify guardianship offline, and choosing "Parent" doesn't make it official. Sharing sensitive information about a minor with others still needs proper authorization.</Notice>
                </View>
              ) : null}
              {error ? <Text style={{ color: C.red, fontWeight: "600" }} accessibilityLiveRegion="polite">{error}</Text> : null}
              <PrimaryButton label="Continue" onPress={next} />
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: C.text }]} accessibilityRole="header">How would you like to manage their care?</Text>
              <Pressable style={[styles.option, { borderColor: C.border, backgroundColor: C.surface }]} onPress={onThisPhone} disabled={busy} accessibilityRole="button" accessibilityLabel="On This iPhone. Manage their health information locally, even if they don't use Synapse.">
                <Ionicons name="phone-portrait-outline" size={26} color={C.tint} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: C.text }]}>On This iPhone</Text>
                  <Text style={[styles.optionBody, { color: C.textSecondary }]}>Manage their health information locally, even if they don't use Synapse.</Text>
                </View>
              </Pressable>
              <Pressable style={[styles.option, { borderColor: C.border, backgroundColor: C.surface }]} onPress={onConnectPress} disabled={busy} accessibilityRole="button" accessibilityLabel="Connect With Their Synapse. Exchange selected care information with someone who uses Synapse on their own iPhone.">
                <Ionicons name="link-outline" size={26} color={C.tint} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: C.text }]}>Connect With Their Synapse</Text>
                  <Text style={[styles.optionBody, { color: C.textSecondary }]}>Exchange selected care information with someone who uses Synapse on their own iPhone.</Text>
                </View>
              </Pressable>
              <Notice>A connection is not automatic syncing. You both need Synapse, you both confirm, and information moves only when someone chooses to share it. Your details stay on this iPhone either way.</Notice>
              <Body>You can change how you manage their care later.</Body>
              <SecondaryButton label="Back" onPress={() => setStep("details")} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3 },
  prompt: { fontSize: 16, fontWeight: "500" },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  option: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, minHeight: 80 },
  optionTitle: { fontSize: 17, fontWeight: "800" },
  optionBody: { fontSize: 13, lineHeight: 19, marginTop: 3 },
});

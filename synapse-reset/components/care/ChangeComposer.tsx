import React, { useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { useTheme } from "@/contexts/ThemeContext";
import TextInput from "@/components/DoneTextInput";
import { buildChangePackage, newChangeId } from "@/lib/care/changes";
import { describeChange, describeFieldChanges } from "@/lib/care/changes-core";
import type { CareConnection, ProposedChange, SharedAppointment, SharedMedication, SharingCategory, StoredSharedData } from "@/lib/care/types";
import { Body, Card, Notice, PrimaryButton, Row, SecondaryButton, SectionLabel } from "./ui";
import { TimeField } from "./pickers";

type Props = {
  conn: CareConnection;
  shared: StoredSharedData;
  myName: string;
  myTimeZone: string;
  onSent: () => void;
};

type Form =
  | { kind: "med_add" }
  | { kind: "med_update"; med: SharedMedication }
  | { kind: "med_stop" }
  | { kind: "appt_add" }
  | { kind: "appt_update"; appt: SharedAppointment }
  | { kind: "appt_cancel" }
  | { kind: "confirm" }
  | null;

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const splitDose = (dose?: string): { amount?: string; unit?: string } => {
  const m = /^\s*([\d.]+)\s*(.*)$/.exec(dose ?? "");
  return m ? { amount: m[1], unit: m[2].trim() || undefined } : {};
};
const medBefore = (m: SharedMedication) => ({ name: m.name, ...splitDose(m.dose), times: m.times });

/** Staging area for change proposals. Nothing here edits anything: it builds a file the owner reviews. */
export default function ChangeComposer({ conn, shared, myName, myTimeZone, onSent }: Props) {
  const { colors: C } = useTheme();
  const allowed = new Set<SharingCategory>(shared.editable);
  const meds = shared.med_schedule?.items ?? [];
  const appts = shared.upcoming_appointments?.items ?? [];
  const [staged, setStaged] = useState<ProposedChange[]>([]);
  const [form, setForm] = useState<Form>(null);
  const [busy, setBusy] = useState(false);

  const stage = (c: ProposedChange) => {
    setStaged((s) => [...s, c]);
    setForm(null);
    void Haptics.selectionAsync();
  };

  const send = async () => {
    setBusy(true);
    try {
      const r = await buildChangePackage(conn, staged, myName, myTimeZone);
      if (!r.ok) {
        Alert.alert("Couldn't prepare suggestions", r.reason === "not_authorized" ? `${conn.peerName} hasn't allowed suggestions for one of these.` : "Try again.");
        return;
      }
      const uri = `${FileSystem.cacheDirectory}Synapse-Suggestions-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(uri, r.json);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: `Send suggestions to ${conn.peerName}` });
      setStaged([]);
      onSent();
    } finally {
      setBusy(false);
    }
  };

  const buttons: { label: string; show: boolean; form: Form; icon?: string }[] = [
    { label: "Change a medication", show: allowed.has("med_schedule") && meds.length > 0, form: { kind: "med_update", med: meds[0] } },
    { label: "Add a medication", show: allowed.has("med_schedule"), form: { kind: "med_add" } },
    { label: "Stop a medication", show: allowed.has("med_schedule") && meds.length > 0, form: { kind: "med_stop" } },
    { label: "Add an appointment", show: allowed.has("upcoming_appointments"), form: { kind: "appt_add" } },
    { label: "Change an appointment", show: allowed.has("upcoming_appointments") && appts.length > 0, form: { kind: "appt_update", appt: appts[0] } },
    { label: "Cancel an appointment", show: allowed.has("upcoming_appointments") && appts.length > 0, form: { kind: "appt_cancel" } },
    { label: "Mark a dose as taken", show: allowed.has("med_confirmations") && meds.length > 0, form: { kind: "confirm" } },
  ];

  return (
    <>
      <SectionLabel>Suggest changes to {shared.fromName}'s records</SectionLabel>
      <Card>
        <Notice icon="shield-checkmark-outline">These are suggestions. {shared.fromName} reviews every one on their own iPhone, and nothing changes unless they accept it. Your suggestions are based on their last shared update, not live information.</Notice>
        {buttons.filter((b) => b.show).map((b) => (
          <SecondaryButton key={b.label} label={b.label} onPress={() => setForm(b.form)} />
        ))}
      </Card>

      {staged.length ? (
        <>
          <SectionLabel>Ready to send</SectionLabel>
          <Card>
            {staged.map((c) => (
              <Row key={c.id} title={describeChange(c)} right={<Pressable onPress={() => setStaged((s) => s.filter((x) => x.id !== c.id))} accessibilityRole="button" accessibilityLabel="Remove this suggestion" hitSlop={10}><Text style={{ color: C.red, fontWeight: "700" }}>Remove</Text></Pressable>} />
            ))}
            <PrimaryButton label={`Send ${staged.length} suggestion${staged.length === 1 ? "" : "s"}`} icon="share-outline" onPress={send} busy={busy} />
            <SecondaryButton label="Discard all" onPress={() => setStaged([])} />
          </Card>
        </>
      ) : null}

      <FormModal form={form} meds={meds} appts={appts} onClose={() => setForm(null)} onStage={stage} name={shared.fromName} />
    </>
  );
}

function FormModal({ form, meds, appts, onClose, onStage, name }: { form: Form; meds: SharedMedication[]; appts: SharedAppointment[]; onClose: () => void; onStage: (c: ProposedChange) => void; name: string }) {
  const { colors: C } = useTheme();
  const [medKey, setMedKey] = useState<string | null>(null);
  const [apptKey, setApptKey] = useState<string | null>(null);
  const [fName, setFName] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState("09:00");
  const [doctor, setDoctor] = useState("");
  const [place, setPlace] = useState("");
  const [doseDate, setDoseDate] = useState(new Date());
  const [doseIndex, setDoseIndex] = useState(0);

  React.useEffect(() => {
    if (!form) return;
    setMedKey(null);
    setApptKey(null);
    setFName("");
    setAmount("");
    setUnit("");
    setTimes(["08:00"]);
    setDate(new Date());
    setTime("09:00");
    setDoctor("");
    setPlace("");
    setDoseDate(new Date());
    setDoseIndex(0);
  }, [form]);

  if (!form) return null;
  const med = meds.find((m) => m.key === medKey) ?? null;
  const appt = appts.find((a) => a.key === apptKey) ?? null;

  const pickMed = (m: SharedMedication) => {
    setMedKey(m.key);
    const d = splitDose(m.dose);
    setFName(m.name);
    setAmount(d.amount ?? "");
    setUnit(d.unit ?? "");
    setTimes(m.times.length ? m.times : ["08:00"]);
  };
  const pickAppt = (a: SharedAppointment) => {
    setApptKey(a.key);
    setDate(new Date(`${a.date}T12:00:00`));
    setTime(a.time && /^\d{1,2}:\d{2}$/.test(a.time) ? a.time.padStart(5, "0") : "09:00");
    setDoctor(a.doctorName ?? "");
    setPlace(a.location ?? "");
  };

  const submit = () => {
    const id = newChangeId();
    if (form.kind === "med_add") {
      if (!fName.trim() || times.length === 0) return Alert.alert("Add a name and at least one time.");
      onStage({ id, category: "med_schedule", op: "add", after: { name: fName.trim(), amount: amount.trim() || undefined, unit: unit.trim() || undefined, times } });
    } else if (form.kind === "med_update") {
      if (!med) return Alert.alert("Pick a medication first.");
      const before = medBefore(med);
      const after: Record<string, unknown> = {};
      if (fName.trim() && fName.trim() !== before.name) after.name = fName.trim();
      if (amount.trim() && amount.trim() !== before.amount) after.amount = amount.trim();
      if (unit.trim() && unit.trim() !== before.unit) after.unit = unit.trim();
      if (JSON.stringify(times) !== JSON.stringify(before.times)) after.times = times;
      if (Object.keys(after).length === 0) return Alert.alert("Nothing changed yet.");
      onStage({ id, category: "med_schedule", op: "update", key: med.key, before, after });
    } else if (form.kind === "med_stop") {
      if (!med) return Alert.alert("Pick a medication first.");
      onStage({ id, category: "med_schedule", op: "stop", key: med.key, before: medBefore(med) });
    } else if (form.kind === "appt_add") {
      onStage({ id, category: "upcoming_appointments", op: "add", after: { date: isoDate(date), time, doctorName: doctor.trim() || undefined, location: place.trim() || undefined } });
    } else if (form.kind === "appt_update") {
      if (!appt) return Alert.alert("Pick an appointment first.");
      const before = { date: appt.date, time: appt.time, doctorName: appt.doctorName, location: appt.location };
      const after: Record<string, unknown> = {};
      if (isoDate(date) !== appt.date) after.date = isoDate(date);
      if (time !== appt.time) after.time = time;
      if ((doctor.trim() || undefined) !== appt.doctorName) after.doctorName = doctor.trim() || undefined;
      if ((place.trim() || undefined) !== appt.location) after.location = place.trim() || undefined;
      if (Object.keys(after).length === 0) return Alert.alert("Nothing changed yet.");
      onStage({ id, category: "upcoming_appointments", op: "update", key: appt.key, before, after });
    } else if (form.kind === "appt_cancel") {
      if (!appt) return Alert.alert("Pick an appointment first.");
      onStage({ id, category: "upcoming_appointments", op: "cancel", key: appt.key, before: { date: appt.date, time: appt.time, doctorName: appt.doctorName, location: appt.location } });
    } else if (form.kind === "confirm") {
      if (!med) return Alert.alert("Pick a medication first.");
      onStage({ id, category: "med_confirmations", op: "confirm", after: { medicationKey: med.key, medicationName: med.name, date: isoDate(doseDate), doseIndex } });
    }
  };

  const needsMed = form.kind === "med_update" || form.kind === "med_stop" || form.kind === "confirm";
  const needsAppt = form.kind === "appt_update" || form.kind === "appt_cancel";
  const title = { med_add: "Add a medication", med_update: "Change a medication", med_stop: "Stop a medication", appt_add: "Add an appointment", appt_update: "Change an appointment", appt_cancel: "Cancel an appointment", confirm: "Mark a dose as taken" }[form.kind];
  const inputStyle = { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated, paddingHorizontal: 12, fontSize: 16, color: C.text } as const;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: C.background }} contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 24, fontWeight: "800", color: C.text }} accessibilityRole="header">{title}</Text>
        <Body>This is a suggestion for {name} to review. It won't change anything until they accept it.</Body>

        {needsMed ? (
          <Card>
            <Text style={{ fontWeight: "700", color: C.text }}>Which medication?</Text>
            {meds.map((m) => (
              <Row key={m.key} title={m.name} subtitle={[m.dose, m.times.join(", ")].filter(Boolean).join(" · ")} onPress={() => pickMed(m)} right={<Text style={{ color: medKey === m.key ? C.tint : C.textTertiary, fontWeight: "700" }}>{medKey === m.key ? "Selected" : "Choose"}</Text>} />
            ))}
          </Card>
        ) : null}
        {needsAppt ? (
          <Card>
            <Text style={{ fontWeight: "700", color: C.text }}>Which appointment?</Text>
            {appts.map((a) => (
              <Row key={a.key} title={a.doctorName || "Appointment"} subtitle={[a.date, a.time, a.location].filter(Boolean).join(" · ")} onPress={() => pickAppt(a)} right={<Text style={{ color: apptKey === a.key ? C.tint : C.textTertiary, fontWeight: "700" }}>{apptKey === a.key ? "Selected" : "Choose"}</Text>} />
            ))}
          </Card>
        ) : null}

        {form.kind === "med_add" || (form.kind === "med_update" && med) ? (
          <Card>
            <TextInput value={fName} onChangeText={setFName} placeholder="Medication name" placeholderTextColor={C.textTertiary} style={inputStyle} accessibilityLabel="Medication name" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput value={amount} onChangeText={setAmount} placeholder="Amount" placeholderTextColor={C.textTertiary} keyboardType="decimal-pad" style={[inputStyle, { flex: 1 }]} accessibilityLabel="Amount" />
              <TextInput value={unit} onChangeText={setUnit} placeholder="Unit (mg, mcg)" placeholderTextColor={C.textTertiary} style={[inputStyle, { flex: 1 }]} accessibilityLabel="Unit" />
            </View>
            <Text style={{ fontWeight: "700", color: C.text }}>Times of day</Text>
            {times.map((t, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <TimeField label={`Time ${i + 1}`} value={t} onChange={(v) => setTimes((all) => all.map((x, j) => (j === i ? v : x)))} />
                </View>
                {times.length > 1 ? (
                  <Pressable onPress={() => setTimes((all) => all.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove time ${i + 1}`} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: C.red, fontWeight: "700" }}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            <SecondaryButton label="Add another time" onPress={() => setTimes((all) => (all.length < 6 ? [...all, "20:00"] : all))} />
            {form.kind === "med_update" && med ? <Notice>{describeFieldChanges({ times: med.times }, { times }).map((f) => `${f.field}: ${f.from} → ${f.to}`).join("\n")}</Notice> : null}
          </Card>
        ) : null}

        {form.kind === "appt_add" || (form.kind === "appt_update" && appt) ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "700", color: C.text }}>Date</Text>
              <DateTimePicker value={date} mode="date" display="compact" onChange={(_, d) => d && setDate(d)} accessibilityLabel="Appointment date" />
            </View>
            <TimeField label="Time" value={time} onChange={setTime} />
            <TextInput value={doctor} onChangeText={setDoctor} placeholder="Doctor (optional)" placeholderTextColor={C.textTertiary} style={inputStyle} accessibilityLabel="Doctor" />
            <TextInput value={place} onChangeText={setPlace} placeholder="Place (optional)" placeholderTextColor={C.textTertiary} style={inputStyle} accessibilityLabel="Place" />
          </Card>
        ) : null}

        {form.kind === "confirm" && med ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "700", color: C.text }}>Which day?</Text>
              <DateTimePicker value={doseDate} mode="date" display="compact" maximumDate={new Date()} onChange={(_, d) => d && setDoseDate(d)} accessibilityLabel="Day of the dose" />
            </View>
            {med.times.length > 1 ? (
              <>
                <Text style={{ fontWeight: "700", color: C.text }}>Which dose?</Text>
                {med.times.map((t, i) => (
                  <Row key={t} title={t} onPress={() => setDoseIndex(i)} right={<Text style={{ color: doseIndex === i ? C.tint : C.textTertiary, fontWeight: "700" }}>{doseIndex === i ? "Selected" : "Choose"}</Text>} />
                ))}
              </>
            ) : null}
            <Notice>It will be recorded as confirmed by you, not by {name}.</Notice>
          </Card>
        ) : null}

        <PrimaryButton label="Add to suggestions" onPress={submit} />
        <SecondaryButton label="Cancel" onPress={onClose} />
        {Platform.OS === "web" ? null : <View style={{ height: 20 }} />}
      </ScrollView>
    </Modal>
  );
}

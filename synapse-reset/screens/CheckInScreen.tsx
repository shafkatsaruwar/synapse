import React, { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import TextInput from "@/components/DoneTextInput";
import {
  addContact, deleteContact, deleteHistory, loadCheckInState, loadPeople, markComplete, pendingReminders, prepareMessage,
  saveSettings, savePersonPrefs, shareMessage, startCall, syncCheckInReminders, updateContact, type CheckInPerson,
} from "@/lib/care/checkin";
import { CHECKIN_TOPICS, checkInTemplate, postponementExplanation, type CheckInDirection, type CheckInTopic } from "@/lib/care/checkin-core";
import { CHECKIN_DELAY_OPTIONS, MAX_CUSTOM_DELAY_MINUTES } from "@/lib/care/checkin-schedule";
import { deviceTimeZone, formatInZone, zoneShortName } from "@/lib/care/time-zone";
import type { CheckInEvent, CheckInReminderRecord, CheckInSettings, PersonCheckInPrefs } from "@/lib/care/types";
import { Body, Card, Notice, Pill, PrimaryButton, Row, ScreenHeader, SecondaryButton, SectionLabel, useCareStyles } from "@/components/care/ui";
import { ChipRow, ContactHoursEditor, TimeField, TimeZoneField, formatHhmm } from "@/components/care/pickers";

type Tab = "mine" | "people" | "reminders";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = { onBack?: () => void; onNavigate?: (key: string) => void; initialPersonId?: string | null };

export default function CheckInScreen({ onBack, onNavigate, initialPersonId }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors: C } = useTheme();
  const [tab, setTab] = useState<Tab>(initialPersonId ? "people" : "mine");
  const [people, setPeople] = useState<CheckInPerson[]>([]);
  const [settings, setSettings] = useState<CheckInSettings | null>(null);
  const [prefs, setPrefs] = useState<Record<string, PersonCheckInPrefs>>({});
  const [events, setEvents] = useState<CheckInEvent[]>([]);
  const [pending, setPending] = useState<CheckInReminderRecord[]>([]);
  const [editing, setEditing] = useState<string | null>(initialPersonId ?? null);

  const reload = useCallback(async () => {
    const [p, state, pend] = await Promise.all([loadPeople(), loadCheckInState(), pendingReminders()]);
    setPeople(p);
    setSettings(state.settings);
    setPrefs(state.prefs);
    setEvents([...state.events].reverse());
    setPending(pend);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const topPad = width >= 768 ? 28 : Platform.OS === "web" ? 40 : 8;
  const tabs: { id: Tab; label: string }[] = [
    { id: "mine", label: "My Check-Ins" },
    { id: "people", label: "People" },
    { id: "reminders", label: "Reminders" },
  ];

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Check-In" subtitle="Stay connected with people you care about." onBack={onBack} />
      <View style={[styles.tabs, { backgroundColor: C.surfaceElevated, borderColor: C.border }]} accessibilityRole="tablist">
        {tabs.map((t) => {
          const on = tab === t.id;
          return (
            <Pressable key={t.id} style={[styles.tab, on && { backgroundColor: C.surface }]} onPress={() => { setTab(t.id); setEditing(null); }} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
              <Text style={{ fontWeight: "700", fontSize: 13, color: on ? C.text : C.textSecondary }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "mine" ? <MineTab people={people} events={events} onChanged={reload} /> : null}
      {tab === "people" && settings ? (
        <PeopleTab people={people} prefs={prefs} settings={settings} editing={editing} setEditing={setEditing} onChanged={reload} onNavigate={onNavigate} />
      ) : null}
      {tab === "reminders" && settings ? <RemindersTab people={people} prefs={prefs} settings={settings} pending={pending} onChanged={reload} /> : null}
    </ScrollView>
  );
}

// ---------- My Check-Ins ----------

function MineTab({ people, events, onChanged }: { people: CheckInPerson[]; events: CheckInEvent[]; onChanged: () => void }) {
  const { colors: C } = useTheme();
  const [direction, setDirection] = useState<CheckInDirection>("send");
  const [topic, setTopic] = useState<CheckInTopic>("medication");
  const [personId, setPersonId] = useState<string | null>(null);
  const [message, setMessage] = useState(checkInTemplate("send", "medication"));
  const [details, setDetails] = useState("");
  const [edited, setEdited] = useState(false);
  const person = people.find((p) => p.id === personId) ?? null;

  const apply = (d: CheckInDirection, t: CheckInTopic) => {
    setDirection(d);
    setTopic(t);
    if (!edited) setMessage(checkInTemplate(d, t));
  };

  const fullMessage = details.trim() ? `${message.trim()}\n\n${details.trim()}` : message.trim();

  const send = async (via: "messages" | "share") => {
    if (!fullMessage) return;
    const id = personId ?? "self";
    const label = CHECKIN_TOPICS.find((t) => t.id === topic)?.label;
    const r = via === "messages" ? await prepareMessage(id, person?.phone, fullMessage, label) : await shareMessage(id, fullMessage, label);
    if (r === "unavailable") Alert.alert("Couldn't open Messages", "Try the share sheet instead.");
    onChanged();
  };

  const call = async () => {
    if (!person) return;
    const r = await startCall(person.id, person.phone);
    if (r === "unavailable") Alert.alert("No phone number", `Add a phone number for ${person.name} in People.`);
    onChanged();
  };

  const recent = events.filter((e) => e.type !== "reminder_scheduled").slice(0, 12);

  return (
    <>
      <SectionLabel>What would you like to do?</SectionLabel>
      <ChipRow options={["send", "check_on"] as const} value={direction} onChange={(d) => apply(d, topic)} format={(d) => (d === "send" ? "Send a Check-In" : "Check on Someone")} />

      <SectionLabel>About</SectionLabel>
      <ChipRow options={CHECKIN_TOPICS.map((t) => t.id)} value={topic} onChange={(t) => apply(direction, t)} format={(t) => CHECKIN_TOPICS.find((x) => x.id === t)!.label} />

      <SectionLabel>{direction === "send" ? "Who is it for?" : "Who are you checking on?"}</SectionLabel>
      <Card>
        {people.length === 0 ? <Body>Add someone in the People tab to message them directly, or just use the share sheet below.</Body> : null}
        <Row title="Choose in the share sheet" subtitle="Pick anyone when you send" right={<Pill label={personId === null ? "Selected" : "Choose"} tone={personId === null ? "good" : "neutral"} />} onPress={() => setPersonId(null)} />
        {people.map((p) => (
          <Row key={p.id} icon="person-outline" title={p.name} subtitle={`${p.subtitle} · ${formatInZone(Date.now(), p.timeZone, { hour: "numeric", minute: "2-digit" })} there`} right={<Pill label={personId === p.id ? "Selected" : "Choose"} tone={personId === p.id ? "good" : "neutral"} />} onPress={() => setPersonId(p.id)} />
        ))}
        {person ? <ContactHint person={person} /> : null}
      </Card>

      <SectionLabel>Your message</SectionLabel>
      <Card>
        <Body>Edit it however you like. Nothing is sent until you press Send in Messages.</Body>
        <TextInput value={message} onChangeText={(t) => { setMessage(t); setEdited(true); }} multiline style={[styles.input, { color: C.text, borderColor: C.border }]} accessibilityLabel="Message" />
        <Body>Want to include specifics? Add them yourself. Synapse never adds medication names, doses, or diagnoses for you.</Body>
        <TextInput value={details} onChangeText={setDetails} placeholder="Optional details you choose to add" placeholderTextColor={C.textTertiary} multiline style={[styles.input, { color: C.text, borderColor: C.border, minHeight: 52 }]} accessibilityLabel="Optional details" />
        <PrimaryButton label="Open Messages" icon="chatbubble-ellipses-outline" onPress={() => send("messages")} disabled={!fullMessage} />
        <SecondaryButton label="Use the share sheet" icon="share-outline" onPress={() => send("share")} disabled={!fullMessage} />
        {direction === "check_on" && person ? <SecondaryButton label={`Call ${person.name}`} icon="call-outline" onPress={call} disabled={!person.phone} /> : null}
        <SecondaryButton label="Cancel" onPress={() => { setMessage(checkInTemplate(direction, topic)); setDetails(""); setEdited(false); }} />
      </Card>
      <Notice>Synapse opens your Messages app and stops there. It can't see whether a message was sent, delivered, or read.</Notice>

      {direction === "check_on" && person ? (
        <Card style={{ marginTop: 12 }}>
          <SecondaryButton label="Mark this check-in done" icon="checkmark-circle-outline" onPress={async () => { await markComplete(person.id, CHECKIN_TOPICS.find((t) => t.id === topic)?.label); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onChanged(); }} />
        </Card>
      ) : null}

      <SectionLabel>Recent activity</SectionLabel>
      <Card>
        {recent.length === 0 ? <Body>Nothing yet.</Body> : recent.map((e) => <HistoryRow key={e.id} e={e} people={people} />)}
        {recent.length ? (
          <SecondaryButton label="Delete my Check-In history" icon="trash-outline" destructive onPress={() => Alert.alert("Delete history?", "This clears the activity list on this iPhone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { await deleteHistory(); onChanged(); } }])} />
        ) : null}
      </Card>
    </>
  );
}

const EVENT_LABEL: Record<CheckInEvent["type"], string> = {
  reminder_scheduled: "Reminder set",
  reminder_opened: "Reminder opened",
  reminder_dismissed: "Reminder dismissed",
  reminder_rescheduled: "Reminder pushed back",
  message_prepared: "Message prepared",
  marked_complete: "Marked check-in done",
  wellness_update: "Wellness update noted",
};

function HistoryRow({ e, people }: { e: CheckInEvent; people: CheckInPerson[] }) {
  const who = e.profileId === "self" ? "General" : people.find((p) => p.id === e.profileId)?.name ?? "Someone";
  const how = e.channel === "messages" ? " · Messages" : e.channel === "call" ? " · Call" : e.channel === "share" ? " · Share sheet" : "";
  return <Row title={`${EVENT_LABEL[e.type]}${e.label ? ` · ${e.label}` : ""}`} subtitle={`${who}${how} · ${new Date(e.at).toLocaleString()}`} />;
}

function ContactHint({ person }: { person: CheckInPerson }) {
  const now = Date.now();
  const mine = deviceTimeZone();
  const same = mine === person.timeZone;
  let within: boolean | null = null;
  if (person.contactHours) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: person.timeZone, hourCycle: "h23", hour: "numeric", minute: "numeric" }).formatToParts(new Date(now));
    const minute = Number(parts.find((p) => p.type === "hour")?.value) * 60 + Number(parts.find((p) => p.type === "minute")?.value);
    const [sh, sm] = person.contactHours.start.split(":").map(Number);
    const [eh, em] = person.contactHours.end.split(":").map(Number);
    const s = sh * 60 + sm;
    const e = eh * 60 + em;
    within = s < e ? minute >= s && minute < e : minute >= s || minute < e;
  }
  return (
    <Notice icon="time-outline">
      It's {formatInZone(now, person.timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })} {zoneShortName(now, person.timeZone)} for {person.name}
      {same ? "" : ` (${formatInZone(now, mine, { hour: "numeric", minute: "2-digit" })} for you)`}.
      {within === false && person.contactHours ? ` They prefer to hear from people between ${formatHhmm(person.contactHours.start)} and ${formatHhmm(person.contactHours.end)}.` : ""}
    </Notice>
  );
}

// ---------- People ----------

function PeopleTab({ people, prefs, settings, editing, setEditing, onChanged, onNavigate }: { people: CheckInPerson[]; prefs: Record<string, PersonCheckInPrefs>; settings: CheckInSettings; editing: string | null; setEditing: (id: string | null) => void; onChanged: () => void; onNavigate?: (key: string) => void }) {
  const [adding, setAdding] = useState(false);
  const person = people.find((p) => p.id === editing);

  if (adding) return <AddContact onDone={() => { setAdding(false); onChanged(); }} />;
  if (person) return <PersonSettings person={person} prefs={prefs[person.id]} settings={settings} onBack={() => setEditing(null)} onChanged={onChanged} />;

  return (
    <>
      <SectionLabel>People</SectionLabel>
      <Card>
        {people.length === 0 ? <Body>Add someone you'd like to check in with, or set up a care connection.</Body> : null}
        {people.map((p) => (
          <Row key={p.id} icon={p.kind === "connection" ? "link-outline" : p.kind === "profile" ? "person-outline" : "call-outline"} title={p.name} subtitle={`${p.subtitle} · ${prefs[p.id]?.remindersEnabled ? "Reminders on" : "Reminders off"}`} onPress={() => setEditing(p.id)} />
        ))}
      </Card>
      <View style={{ gap: 10, marginTop: 12 }}>
        <PrimaryButton label="Add someone" icon="person-add-outline" onPress={() => setAdding(true)} />
        {onNavigate ? <SecondaryButton label="Care Connections" icon="people-outline" onPress={() => onNavigate("careconnections")} /> : null}
      </View>
      <Notice>Check-In works for anyone. You don't need caregiver mode, and the other person doesn't need Synapse.</Notice>
    </>
  );
}

function AddContact({ onDone }: { onDone: () => void }) {
  const { colors: C } = useTheme();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [tz, setTz] = useState(deviceTimeZone());
  return (
    <>
      <ScreenHeader title="Add someone" subtitle="Saved only on this iPhone." onBack={onDone} />
      <Card>
        <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={C.textTertiary} style={[styles.line, { color: C.text, borderColor: C.border }]} accessibilityLabel="Name" />
        <TextInput value={phone} onChangeText={setPhone} placeholder="Phone number (optional)" placeholderTextColor={C.textTertiary} keyboardType="phone-pad" style={[styles.line, { color: C.text, borderColor: C.border }]} accessibilityLabel="Phone number" />
        <TextInput value={relationship} onChangeText={setRelationship} placeholder="Relationship (optional)" placeholderTextColor={C.textTertiary} style={[styles.line, { color: C.text, borderColor: C.border }]} accessibilityLabel="Relationship" />
        <TimeZoneField value={tz} onChange={setTz} label="Where they live" />
        <PrimaryButton label="Save" disabled={!name.trim()} onPress={async () => { await addContact({ name, phone, relationship, timeZone: tz }); onDone(); }} />
      </Card>
    </>
  );
}

function PersonSettings({ person, prefs, settings, onBack, onChanged }: { person: CheckInPerson; prefs?: PersonCheckInPrefs; settings: CheckInSettings; onBack: () => void; onChanged: () => void }) {
  const { colors: C } = useTheme();
  const p: PersonCheckInPrefs = prefs ?? { personId: person.id, delayMinutes: settings.defaultDelayMinutes, remindersEnabled: false, weekdays: [] };
  const [custom, setCustom] = useState(CHECKIN_DELAY_OPTIONS.includes(p.delayMinutes as 10 | 15 | 30) ? "" : String(p.delayMinutes));
  const [tz, setTz] = useState(person.timeZone);
  const hasSchedule = person.doses.length > 0;

  const update = async (patch: Partial<PersonCheckInPrefs>) => {
    await savePersonPrefs(person.id, patch);
    await syncCheckInReminders().catch(() => {});
    onChanged();
  };

  return (
    <>
      <ScreenHeader title={person.name} subtitle={person.subtitle} onBack={onBack} />
      <Card>
        <Row icon="time-outline" title={`${formatInZone(Date.now(), person.timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })} ${zoneShortName(Date.now(), person.timeZone)}`} subtitle={`Their local time · ${person.timeZone}`} />
        {person.doseSource === "shared_update" && person.sharedAt ? <Row icon="refresh-outline" title="Schedule from their last shared update" subtitle={`Received ${new Date(person.sharedAt).toLocaleString()}. Not live.`} /> : null}
        {person.doseSource === "saved_schedule" ? <Row icon="medkit-outline" title="Using the schedule saved on this iPhone" subtitle={`${person.doses.length} dose time${person.doses.length === 1 ? "" : "s"}`} /> : null}
      </Card>

      <SectionLabel>Reminders</SectionLabel>
      <Card>
        <Row title="Gentle check-in reminders" subtitle={hasSchedule ? "A little nudge around their usual medication time" : person.kind === "contact" ? "Trusted contacts don't have a medication schedule here" : "Add medication times or import their schedule first"} right={<Switch value={p.remindersEnabled} onValueChange={(v) => update({ remindersEnabled: v })} disabled={!hasSchedule} accessibilityLabel="Check-in reminders" />} />
        {hasSchedule ? (
          <>
            <Body>Check in this long after their usual time. It's a pause before a friendly nudge, not a sign anything was missed.</Body>
            <ChipRow options={CHECKIN_DELAY_OPTIONS} value={(CHECKIN_DELAY_OPTIONS as readonly number[]).includes(p.delayMinutes) ? (p.delayMinutes as 10 | 15 | 30) : (0 as never)} onChange={(v) => { setCustom(""); void update({ delayMinutes: v }); }} format={(v) => `${v} min`} />
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput value={custom} onChangeText={setCustom} placeholder="Custom minutes" placeholderTextColor={C.textTertiary} keyboardType="number-pad" style={[styles.line, { flex: 1, color: C.text, borderColor: C.border }]} accessibilityLabel="Custom delay in minutes" />
              <SecondaryButton label="Set" onPress={() => { const n = parseInt(custom, 10); if (Number.isFinite(n) && n >= 1 && n <= MAX_CUSTOM_DELAY_MINUTES) void update({ delayMinutes: n }); else Alert.alert("Pick 1 to " + MAX_CUSTOM_DELAY_MINUTES + " minutes"); }} />
            </View>
            <Text style={{ fontWeight: "700", fontSize: 13, color: C.textSecondary, marginTop: 6 }}>Days</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {WEEKDAYS.map((d, i) => {
                const on = p.weekdays.length === 0 || p.weekdays.includes(i);
                return (
                  <Pressable key={d} onPress={() => { const base = p.weekdays.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : p.weekdays; const next = base.includes(i) ? base.filter((x) => x !== i) : [...base, i]; void update({ weekdays: next.length === 7 ? [] : next }); }} style={[styles.dayChip, { borderColor: on ? C.tint : C.border, backgroundColor: on ? C.tintLight : C.surface }]} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={d}>
                    <Text style={{ fontWeight: "700", fontSize: 12, color: on ? C.tint : C.textSecondary }}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </Card>

      {person.kind === "contact" ? (
        <>
          <SectionLabel>Their details</SectionLabel>
          <Card>
            <TimeZoneField value={tz} onChange={async (z) => { setTz(z); await updateContact(person.id, { timeZone: z }); onChanged(); }} label="Where they live" />
            <ContactHoursEditor value={person.contactHours} onChange={async (v) => { await updateContact(person.id, { contactHours: v }); onChanged(); }} />
          </Card>
          <View style={{ marginTop: 12 }}>
            <SecondaryButton label="Remove this person" icon="trash-outline" destructive onPress={() => Alert.alert("Remove " + person.name + "?", "This removes them and their Check-In history from this iPhone.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: async () => { await deleteContact(person.id); onBack(); onChanged(); } }])} />
          </View>
        </>
      ) : null}

      <SectionLabel>History</SectionLabel>
      <SecondaryButton label={`Delete history with ${person.name}`} icon="trash-outline" destructive onPress={async () => { await deleteHistory(person.id); onChanged(); }} />
    </>
  );
}

// ---------- Reminders ----------

function RemindersTab({ people, prefs, settings, pending, onChanged }: { people: CheckInPerson[]; prefs: Record<string, PersonCheckInPrefs>; settings: CheckInSettings; pending: CheckInReminderRecord[]; onChanged: () => void }) {
  const { colors: C } = useTheme();
  const s = useCareStyles();
  const [perm, setPerm] = useState<string>("unknown");
  const myZone = settings.followDeviceTimeZone ? deviceTimeZone() : settings.homeTimeZone;

  useEffect(() => {
    Notifications.getPermissionsAsync().then((r) => setPerm(r.granted ? "granted" : r.canAskAgain ? "ask" : "denied")).catch(() => {});
  }, []);

  const change = async (patch: Partial<CheckInSettings>) => {
    await saveSettings(patch);
    await syncCheckInReminders().catch(() => {});
    onChanged();
  };

  const rows = pending.slice(0, 20).map((r) => ({ r, person: people.find((p) => p.id === r.profileId) }));

  return (
    <>
      <SectionLabel>Notifications</SectionLabel>
      <Card>
        {perm === "granted" ? <Row icon="notifications-outline" title="Notifications are on" /> : perm === "denied" ? <Notice icon="alert-circle-outline">Notifications are off for Synapse. Turn them on in Settings to get Check-In reminders.</Notice> : <PrimaryButton label="Allow notifications" onPress={async () => { const r = await Notifications.requestPermissionsAsync(); setPerm(r.granted ? "granted" : "denied"); if (r.granted) await syncCheckInReminders().catch(() => {}); onChanged(); }} />}
        <Body>Reminders are scheduled on this iPhone only. Nobody is notified that you were reminded.</Body>
      </Card>

      <SectionLabel>My time zone for reminders</SectionLabel>
      <Card>
        <Row title="Follow this iPhone's time zone" subtitle={`Now ${zoneShortName(Date.now(), deviceTimeZone())}. Travelling? Reminders move with you.`} right={<Switch value={settings.followDeviceTimeZone} onValueChange={(v) => change({ followDeviceTimeZone: v })} accessibilityLabel="Follow device time zone" />} />
        {!settings.followDeviceTimeZone ? <TimeZoneField value={settings.homeTimeZone} onChange={(z) => change({ homeTimeZone: z })} label="Keep my home time zone" /> : null}
      </Card>

      <SectionLabel>Quiet hours</SectionLabel>
      <Card>
        <Row title="Don't wake me for routine reminders" subtitle="Reminders inside this window wait until it ends." right={<Switch value={!!settings.quietHours} onValueChange={(on) => change({ quietHours: on ? { start: "22:00", end: "07:00" } : null })} accessibilityLabel="Quiet hours" />} />
        {settings.quietHours ? (
          <>
            <TimeField label="Starts" value={settings.quietHours.start} onChange={(t) => change({ quietHours: { ...settings.quietHours!, start: t } })} />
            <TimeField label="Ends" value={settings.quietHours.end} onChange={(t) => change({ quietHours: { ...settings.quietHours!, end: t } })} />
          </>
        ) : null}
      </Card>

      <SectionLabel>Default delay</SectionLabel>
      <Card>
        <Body>Used for people you add next. You can set it per person.</Body>
        <ChipRow options={CHECKIN_DELAY_OPTIONS} value={(CHECKIN_DELAY_OPTIONS as readonly number[]).includes(settings.defaultDelayMinutes) ? (settings.defaultDelayMinutes as 10 | 15 | 30) : (15 as const)} onChange={(v) => change({ defaultDelayMinutes: v })} format={(v) => `${v} min`} />
      </Card>

      <SectionLabel>Coming up</SectionLabel>
      <Card>
        {rows.length === 0 ? <Body>No reminders are scheduled. Turn reminders on for someone in People.</Body> : null}
        {rows.map(({ r, person }) => (
          <View key={r.id} style={{ gap: 2, paddingVertical: 6 }}>
            <Text style={s.rowTitle}>A little check-in with {person?.name ?? "someone"}</Text>
            <Text style={s.rowSub}>
              You'll see it {formatInZone(r.fireInstant, myZone, { weekday: "short", hour: "numeric", minute: "2-digit" })} {zoneShortName(r.fireInstant, myZone)}
            </Text>
            <Text style={s.rowSub}>
              Based on {r.doseLabel} at {formatInZone(r.scheduleInstant, person?.scheduleTimeZone ?? myZone, { hour: "numeric", minute: "2-digit" })} {zoneShortName(r.scheduleInstant, person?.scheduleTimeZone ?? myZone)} their time
            </Text>
            {r.postponedFrom ? <Text style={[s.rowSub, { color: C.orange }]}>{postponementExplanation(person?.name ?? "Their")}</Text> : null}
          </View>
        ))}
      </Card>
      <Notice>These come from a saved schedule, not live medication updates. Synapse can't know whether anyone has taken a dose.</Notice>
    </>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 3, gap: 3 },
  tab: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  input: { minHeight: 80, borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 15, textAlignVertical: "top" },
  line: { minHeight: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
  dayChip: { minWidth: 44, minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});

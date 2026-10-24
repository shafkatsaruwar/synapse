/** Run: npx tsx --test lib/care/checkin-sync.test.ts  (real scheduling code, mocked notification center) */
import { scheduled, smsLog, resetAllDevices } from "./test-mocks";
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getStoresForProfile, setActiveProfileId, SELF_PROFILE_ID } from "../storage";
import { createProfile, updateProfile } from "./profiles";
import { handleCheckInNotificationResponse, loadCheckInState, prepareMessage, deleteHistory, saveSettings, savePersonPrefs, syncCheckInReminders } from "./checkin";
import { FORBIDDEN_WORDING } from "./checkin-core";
import { getLocalParts } from "./time-zone";

beforeEach(() => {
  resetAllDevices();
  setActiveProfileId(SELF_PROFILE_ID);
});

const local = (tz: string, ms: number) => {
  const p = getLocalParts(tz, ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
};

async function jason(opts: { quiet: boolean }) {
  const { profile } = await createProfile({ displayName: "Jason", timeZone: "Europe/London", medScheduleTimeZone: "Europe/London" });
  await getStoresForProfile(profile.id).medicationStorage.save({
    name: "Levothyroxine", frequency: "daily", active: true,
    doses: [{ id: "d1", amount: "200", unit: "mcg", timeOfDay: "Morning", reminderTime: "08:00" }],
  });
  await saveSettings({ followDeviceTimeZone: false, homeTimeZone: "America/New_York", quietHours: opts.quiet ? { start: "22:00", end: "07:00" } : null });
  await savePersonPrefs(profile.id, { remindersEnabled: true, delayMinutes: 15 });
  return profile;
}

const NOW = Date.UTC(2026, 0, 14, 12, 0); // Jan 14 07:00 Boston, 12:00 London

test("08:00 London + 15 min lands at 03:15 Boston, inside quiet hours so it waits until 07:00, and says so", async () => {
  await jason({ quiet: true });
  const plan = await syncCheckInReminders(NOW);
  assert.ok(plan.length > 0);
  const first = [...scheduled.values()].sort((a, b) => a.trigger.date!.getTime() - b.trigger.date!.getTime())[0];
  assert.equal(local("America/New_York", first.trigger.date!.getTime()), "2026-01-15 07:00");
  assert.match(String(first.content.body), /during your quiet hours/);
  assert.equal(first.content.title, "A little check-in with Jason?");
  assert.equal((first.content.data as { notificationType: string }).notificationType, "check-in");
});

test("without quiet hours the reminder fires at the converted time", async () => {
  await jason({ quiet: false });
  await syncCheckInReminders(NOW);
  const first = [...scheduled.values()].sort((a, b) => a.trigger.date!.getTime() - b.trigger.date!.getTime())[0];
  assert.equal(local("America/New_York", first.trigger.date!.getTime()), "2026-01-15 03:15");
});

test("no notification ever claims a missed or untaken dose", async () => {
  await jason({ quiet: true });
  await syncCheckInReminders(NOW);
  for (const n of scheduled.values()) {
    assert.ok(!FORBIDDEN_WORDING.test(`${n.content.title} ${n.content.body}`), String(n.content.body));
  }
});

test("re-syncing replaces reminders instead of piling up, and switching reminders off clears them", async () => {
  const p = await jason({ quiet: false });
  await syncCheckInReminders(NOW);
  const count = scheduled.size;
  await syncCheckInReminders(NOW);
  assert.equal(scheduled.size, count);
  await savePersonPrefs(p.id, { remindersEnabled: false });
  await syncCheckInReminders(NOW);
  assert.equal(scheduled.size, 0);
});

test("changing the person's schedule time zone moves the reminder", async () => {
  const p = await jason({ quiet: false });
  await syncCheckInReminders(NOW);
  const before = [...scheduled.values()][0].trigger.date!.getTime();
  await updateProfile(p.id, { medScheduleTimeZone: "Asia/Dhaka" });
  await syncCheckInReminders(NOW);
  const after = [...scheduled.values()].map((n) => n.trigger.date!.getTime()).sort()[0];
  assert.notEqual(before, after);
  assert.equal(local("America/New_York", after), "2026-01-14 21:15");
});

test("notification buttons: dismiss and later are recorded, open routes to Check-In", async () => {
  const p = await jason({ quiet: false });
  assert.equal(await handleCheckInNotificationResponse("CHECKIN_DISMISS", { personId: p.id }), false);
  assert.equal(await handleCheckInNotificationResponse("CHECKIN_LATER", { personId: p.id }, { title: "A little check-in with Jason?", body: "x" }), false);
  assert.equal(await handleCheckInNotificationResponse("expo.modules.notifications.actions.DEFAULT", { personId: p.id }), true);
  const types = (await loadCheckInState()).events.map((e) => e.type);
  assert.ok(types.includes("reminder_dismissed") && types.includes("reminder_rescheduled") && types.includes("reminder_opened"));
  assert.ok([...scheduled.keys()].some((k) => k.startsWith("checkin-later-")));
});

test("messages are only prepared, never recorded as sent, and history can be deleted per person", async () => {
  const p = await jason({ quiet: false });
  await prepareMessage(p.id, "+15551234567", "Hey! Just wanted to see how you're doing today.", "Wellness");
  assert.equal(smsLog.length, 1);
  const events = (await loadCheckInState()).events.filter((e) => e.profileId === p.id);
  assert.ok(events.some((e) => e.type === "message_prepared"));
  assert.ok(!events.some((e) => /sent|deliver|read/i.test(e.type)));
  await deleteHistory(p.id);
  assert.equal((await loadCheckInState()).events.filter((e) => e.profileId === p.id).length, 0);
});

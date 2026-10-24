/** Run: npx tsx --test lib/care/isolation.test.ts */
import { memory } from "./test-mocks";
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  SELF_PROFILE_ID, getActiveProfileId, getStoresForProfile, medicationLogStorage, medicationStorage, selfStores, setActiveProfileId,
  appointmentStorage, STORAGE_BASE_KEYS,
} from "../storage";
import { clearAllCareData, createProfile, deleteProfile, loadRegistry, migrateLegacyCaregiver, removeLegacyCopies, setActiveProfile } from "./profiles";

beforeEach(() => {
  memory.clear();
  setActiveProfileId(SELF_PROFILE_ID);
});

const med = (name: string) => ({ name, frequency: "daily", active: true, doses: [{ id: "d1", amount: "1", unit: "mg", timeOfDay: "Morning", reminderTime: "08:00" }] });

test("each profile only ever sees its own medications", async () => {
  await selfStores.medicationStorage.save(med("Mine"));
  const { profile: jason } = await createProfile({ displayName: "Jason" });
  const { profile: mom } = await createProfile({ displayName: "Mom" });
  await getStoresForProfile(jason.id).medicationStorage.save(med("Jason-med"));
  await getStoresForProfile(mom.id).medicationStorage.save(med("Mom-med"));

  const names = async (id: string) => (await getStoresForProfile(id).medicationStorage.getAll()).map((m) => m.name);
  assert.deepEqual(await names(SELF_PROFILE_ID), ["Mine"]);
  assert.deepEqual(await names(jason.id), ["Jason-med"]);
  assert.deepEqual(await names(mom.id), ["Mom-med"]);
});

test("the exported storages follow the active profile; selfStores never does", async () => {
  await selfStores.medicationStorage.save(med("Mine"));
  const { profile } = await createProfile({ displayName: "Jason" });
  await getStoresForProfile(profile.id).medicationStorage.save(med("Jason-med"));

  await setActiveProfile(profile.id);
  assert.equal(getActiveProfileId(), profile.id);
  assert.deepEqual((await medicationStorage.getAll()).map((m) => m.name), ["Jason-med"]);
  assert.deepEqual((await selfStores.medicationStorage.getAll()).map((m) => m.name), ["Mine"]);

  await setActiveProfile(SELF_PROFILE_ID);
  assert.deepEqual((await medicationStorage.getAll()).map((m) => m.name), ["Mine"]);
});

test("writes through the active proxy land in the viewed profile, not Self", async () => {
  const { profile } = await createProfile({ displayName: "Jason" });
  await setActiveProfile(profile.id);
  await appointmentStorage.save({ doctorName: "Dr. Lee", specialty: "GP", date: "2030-01-01", time: "10:00", location: "Clinic", notes: "" });
  assert.equal((await selfStores.appointmentStorage.getAll()).length, 0);
  assert.equal((await getStoresForProfile(profile.id).appointmentStorage.getAll()).length, 1);
});

test("self keeps the legacy keys; others are namespaced", async () => {
  await selfStores.medicationStorage.save(med("Mine"));
  assert.ok(memory.has(STORAGE_BASE_KEYS.MEDICATIONS));
  const { profile } = await createProfile({ displayName: "Jason" });
  await getStoresForProfile(profile.id).medicationStorage.save(med("J"));
  assert.ok(memory.has(`fir_p_${profile.id}_${STORAGE_BASE_KEYS.MEDICATIONS}`));
  assert.equal(JSON.parse(memory.get(STORAGE_BASE_KEYS.MEDICATIONS)!).length, 1, "self list untouched by other profile");
});

test("caregiver confirmations are marked as the caregiver's; self confirmations are not", async () => {
  const mine = await selfStores.medicationStorage.save(med("Mine"));
  await selfStores.medicationLogStorage.toggle(mine.id, "2030-01-01", 0);
  const { profile } = await createProfile({ displayName: "Jason" });
  const stores = getStoresForProfile(profile.id);
  const theirs = await stores.medicationStorage.save(med("J"));
  await stores.medicationLogStorage.toggle(theirs.id, "2030-01-01", 0);
  assert.equal((await selfStores.medicationLogStorage.getAll())[0].enteredBy, undefined);
  assert.equal((await stores.medicationLogStorage.getAll())[0].enteredBy, "caregiver");
});

test("app-level settings are shared, not per profile", async () => {
  const { profile } = await createProfile({ displayName: "Jason" });
  await selfStores.settingsStorage.save({ ...(await selfStores.settingsStorage.get()), name: "Sarah" });
  assert.equal((await getStoresForProfile(profile.id).settingsStorage.get()).name, "Sarah");
});

test("deleting a profile removes only its data", async () => {
  await selfStores.medicationStorage.save(med("Mine"));
  const { profile: a } = await createProfile({ displayName: "A" });
  const { profile: b } = await createProfile({ displayName: "B" });
  await getStoresForProfile(a.id).medicationStorage.save(med("A-med"));
  await getStoresForProfile(b.id).medicationStorage.save(med("B-med"));
  await setActiveProfile(a.id);
  const reg = await deleteProfile(a.id);
  assert.equal(reg.activeProfileId, SELF_PROFILE_ID, "falls back to self when the viewed profile is deleted");
  assert.ok(![...memory.keys()].some((k) => k.startsWith(`fir_p_${a.id}_`)));
  assert.equal((await getStoresForProfile(b.id).medicationStorage.getAll()).length, 1);
  assert.equal((await selfStores.medicationStorage.getAll()).length, 1);
  await assert.rejects(() => deleteProfile(SELF_PROFILE_ID));
});

test("legacy caregiver data is copied, originals kept, then cleanable on request", async () => {
  const mine = await selfStores.medicationStorage.save(med("Mine"));
  const theirs = await selfStores.medicationStorage.save({ ...med("Dad-med"), entryOwner: "care_recipient" });
  await selfStores.medicationLogStorage.toggle(theirs.id, "2030-01-01", 0);
  await selfStores.appointmentStorage.save({ doctorName: "Dr. Dad", specialty: "", date: "2030-02-02", time: "09:00", location: "", notes: "", entryOwner: "care_recipient" });
  await selfStores.caregiverProfileStorage.save({ name: "Dad", age: 70, relation: "Father", medications: [], appointments: [], logs: [] });
  await selfStores.roleStorage.save("caregiver");

  const reg = await migrateLegacyCaregiver();
  const dad = reg.profiles.find((p) => p.displayName === "Dad")!;
  assert.ok(dad && dad.type === "caregiver_managed" && dad.legacyAge === 70 && dad.relationship === "Father");
  assert.equal(reg.activeProfileId, dad.id, "someone who was in caregiver mode keeps seeing that person");

  const copied = await getStoresForProfile(dad.id).medicationStorage.getAll();
  assert.deepEqual(copied.map((m) => m.name), ["Dad-med"]);
  assert.equal((await getStoresForProfile(dad.id).medicationLogStorage.getAll()).length, 1);
  assert.equal((await getStoresForProfile(dad.id).appointmentStorage.getAll()).length, 1);
  assert.equal((await selfStores.medicationStorage.getAll()).length, 2, "originals untouched");
  assert.equal(await selfStores.roleStorage.get(), "self", "old exclusive role replaced by flags");
  assert.equal(JSON.parse(memory.get("synapse_care_roles_v1")!).caregiver, true);

  // Idempotent.
  const again = await migrateLegacyCaregiver();
  assert.equal(again.profiles.filter((p) => p.displayName === "Dad").length, 1);

  const removed = await removeLegacyCopies(dad.id);
  assert.deepEqual(removed, { medications: 1, appointments: 1 });
  assert.deepEqual((await selfStores.medicationStorage.getAll()).map((m) => m.name), [mine.name]);
  assert.equal((await getStoresForProfile(dad.id).medicationStorage.getAll()).length, 1, "profile copy untouched");
});

test("migration with nothing to migrate leaves everything alone and marks itself done", async () => {
  await selfStores.medicationStorage.save(med("Mine"));
  const reg = await migrateLegacyCaregiver();
  assert.equal(reg.profiles.length, 1);
  assert.equal(reg.legacyCaregiverMigrated, true);
  assert.equal((await selfStores.medicationStorage.getAll()).length, 1);
});

test("registry survives reload and clearing care data keeps personal records", async () => {
  await selfStores.medicationStorage.save(med("Mine"));
  const { profile } = await createProfile({ displayName: "Jason" });
  await getStoresForProfile(profile.id).medicationStorage.save(med("J"));
  assert.equal((await loadRegistry()).profiles.length, 2);
  await clearAllCareData();
  assert.equal((await loadRegistry()).profiles.length, 1);
  assert.ok(![...memory.keys()].some((k) => k.startsWith("fir_p_") || k.startsWith("synapse_care_")));
  assert.equal((await selfStores.medicationStorage.getAll()).length, 1);
});

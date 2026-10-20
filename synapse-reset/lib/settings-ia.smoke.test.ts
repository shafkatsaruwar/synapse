/**
 * Settings IA smoke — Care / Integrations / Preferences routes stay distinct.
 * Run: npx tsx synapse-reset/lib/settings-ia.smoke.test.ts
 */
import assert from "node:assert/strict";
import { getNavEntry, NAV_REGISTRY } from "./navigation-registry";

{
  console.log("1. Registry keeps Preferences, Care & Sharing, Integrations, Backup separate");
  const prefs = getNavEntry("settings");
  const care = getNavEntry("caresharing");
  const integrations = getNavEntry("integrations");
  const backup = getNavEntry("editprofile");
  assert.equal(prefs?.label, "Preferences");
  assert.equal(care?.label, "Care & Sharing");
  assert.equal(integrations?.label, "Integrations");
  assert.equal(backup?.label, "Backup & Restore");
  assert.equal(prefs?.parent, "accounthub");
  assert.equal(care?.parent, "accounthub");
  assert.equal(integrations?.parent, "accounthub");
  assert.equal(backup?.parent, "accounthub");
}

{
  console.log("2. No registry collision between the four account surfaces");
  const keys = ["settings", "caresharing", "integrations", "editprofile"];
  const found = NAV_REGISTRY.filter((e) => keys.includes(e.key));
  assert.equal(found.length, 4);
  assert.equal(new Set(found.map((e) => e.label)).size, 4);
}

console.log("settings-ia smoke: all assertions passed");

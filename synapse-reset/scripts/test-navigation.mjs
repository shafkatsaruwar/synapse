/**
 * Lightweight navigation matrix checks (no Jest dependency).
 * Run: node scripts/test-navigation.mjs
 */
import assert from "node:assert/strict";

const NAV_ALIASES = {
  home: "dashboard",
  today: "dashboard",
  dailylog: "log",
  feeling: "feelinghub",
  healthrecords: "recordshub",
  wellbeing: "wellbeinghub",
  caresupport: "carehub",
  you: "accounthub",
  labs: "labwork",
  emergency: "emergencyhub",
  emergencycard: "emergencyhub",
};

const PARENT = {
  log: "feelinghub",
  symptoms: "feelinghub",
  monthlycheckin: "feelinghub",
  healthdata: "recordshub",
  labwork: "recordshub",
  imaging: "recordshub",
  timeline: "recordshub",
  reports: "recordshub",
  eating: "wellbeinghub",
  ramadan: "wellbeinghub",
  doctors: "carehub",
  pharmacies: "carehub",
  privacy: "accounthub",
  settings: "accounthub",
};

const TOP = new Set([
  "dashboard",
  "health",
  "medications",
  "appointments",
  "feelinghub",
  "recordshub",
  "wellbeinghub",
  "carehub",
  "emergencyhub",
  "accounthub",
]);

const HAMBURGER = [
  "dashboard",
  "medications",
  "appointments",
  "feelinghub",
  "recordshub",
  "wellbeinghub",
  "carehub",
  "emergencyhub",
  "accounthub",
];

const FULL_BOTTOM = ["dashboard", "health", "accounthub"];

function resolve(raw) {
  return NAV_ALIASES[raw] ?? raw;
}

function pushNav(current, raw, options = {}) {
  const target = resolve(raw);
  if (target === current.screen && !options.reset) return current;
  if (options.reset || TOP.has(target)) return { screen: target, stack: [] };
  const parent = PARENT[target];
  if (parent && current.screen === parent) return { screen: target, stack: [...current.stack, parent] };
  if (parent && current.stack.at(-1) === parent) return { screen: target, stack: current.stack };
  if (parent) return { screen: target, stack: [...current.stack, parent] };
  if (current.screen && current.screen !== target) return { screen: target, stack: [...current.stack, current.screen] };
  return { screen: target, stack: current.stack };
}

function popNav(current, fallback = "dashboard") {
  if (current.stack.length === 0) {
    const parent = PARENT[current.screen];
    if (parent) return { screen: parent, stack: [] };
    return { screen: fallback, stack: [] };
  }
  const stack = [...current.stack];
  const screen = stack.pop();
  return { screen, stack };
}

assert.equal(HAMBURGER.length, 9);
assert.deepEqual(HAMBURGER, [
  "dashboard",
  "medications",
  "appointments",
  "feelinghub",
  "recordshub",
  "wellbeinghub",
  "carehub",
  "emergencyhub",
  "accounthub",
]);

assert.equal(resolve("dailylog"), "log");
assert.equal(resolve("feeling"), "feelinghub");
assert.equal(resolve("health"), "health");
assert.equal(resolve("healthdata"), "healthdata");
assert.deepEqual(FULL_BOTTOM, ["dashboard", "health", "accounthub"]);
assert.ok(!HAMBURGER.includes("health"));

// Flow: Menu → Health Records → Lab Work → Back
let state = pushNav({ screen: "dashboard", stack: [] }, "recordshub");
state = pushNav(state, "labwork");
assert.deepEqual(state, { screen: "labwork", stack: ["recordshub"] });
state = popNav(state);
assert.deepEqual(state, { screen: "recordshub", stack: [] });

// Flow: Menu → How I’m Feeling → Symptoms → Back
state = pushNav({ screen: "dashboard", stack: [] }, "feelinghub");
state = pushNav(state, "symptoms");
assert.deepEqual(state, { screen: "symptoms", stack: ["feelinghub"] });
state = popNav(state);
assert.deepEqual(state, { screen: "feelinghub", stack: [] });

// Flow: Menu → Wellbeing → Ramadan → Back
state = pushNav({ screen: "dashboard", stack: [] }, "wellbeinghub");
state = pushNav(state, "ramadan");
assert.deepEqual(popNav(state), { screen: "wellbeinghub", stack: [] });

// Flow: Menu → Care → Doctors → Back
state = pushNav({ screen: "dashboard", stack: [] }, "carehub");
state = pushNav(state, "doctors");
assert.deepEqual(popNav(state), { screen: "carehub", stack: [] });

// Flow: Menu / Emergency info → Emergency card directly (no protocol hub)
state = pushNav({ screen: "dashboard", stack: [] }, "emergencyhub");
assert.deepEqual(state, { screen: "emergencyhub", stack: [] });
assert.equal(resolve("emergencycard"), "emergencyhub");
assert.equal(resolve("emergency"), "emergencyhub");

// Flow: Menu → You & Settings → Privacy
state = pushNav({ screen: "dashboard", stack: [] }, "accounthub");
state = pushNav(state, "privacy");
assert.deepEqual(state, { screen: "privacy", stack: ["accounthub"] });

// Top-level reset
state = pushNav({ screen: "labwork", stack: ["recordshub"] }, "medications");
assert.deepEqual(state, { screen: "medications", stack: [] });

// No duplicate on repeated tap
const once = pushNav({ screen: "feelinghub", stack: [] }, "log");
assert.deepEqual(pushNav(once, "log"), once);

// Unknown key detection
assert.equal(TOP.has(resolve("not-a-real-screen")), false);
assert.ok(!PARENT["not-a-real-screen"]);

console.log("navigation matrix: all checks passed");

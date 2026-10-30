/**
 * Free vs Synapse Plus feature mapping.
 *
 * Always free:
 * - Medications, schedules, doses, reminders
 * - Appointments and preparation notes
 * - Sick Mode
 * - Basic Emergency Card (view + essential edit)
 * - You & Settings essentials (profile, allergy, privacy, backup, preferences)
 *
 * Synapse Plus:
 * - How I’m Feeling (+ children)
 * - Health Records (+ vitals, labs, imaging, timeline, reports, documents, insights)
 * - Wellbeing (+ children)
 * - Check-In
 * - Care & Support hub (+ doctors, pharmacies, care connections, caregiver tools)
 * - Advanced Emergency Card convenience (export / save / share helpers)
 */

import { resolveNavKey } from "@/lib/navigation-registry";

/** Hubs / screens that require Plus to use (discovery hubs stay visible). */
export const PLUS_REQUIRED_NAV_KEYS = new Set([
  // How I’m Feeling
  "feelinghub",
  "log",
  "logtoday",
  "symptoms",
  "monthlycheckin",
  // Health Records
  "recordshub",
  "healthdata",
  "labwork",
  "imaging",
  "timeline",
  "reports",
  "documents",
  "insights",
  // Wellbeing
  "wellbeinghub",
  "eating",
  "mentalhealth",
  "comfort",
  "goals",
  "cycletracking",
  "ramadan",
  "ramadandailylog",
  // Check-In & Care
  "checkin",
  "carehub",
  "doctors",
  "pharmacies",
  "careconnections",
  "caregiverdashboard",
  "managedperson",
  // Paywall destinations are free to open
]);

/** Always-free destinations (explicit allowlist for safety audits). */
export const ALWAYS_FREE_NAV_KEYS = new Set([
  "dashboard",
  "home",
  "health",
  "medications",
  "appointments",
  "sickmode",
  "emergencyhub",
  "emergencycard",
  "emergency",
  "accounthub",
  "healthprofile",
  "healthprofileconditions",
  "allergy",
  "vaccines",
  "surgeries",
  "settings",
  "appearance",
  "caresharing",
  "integrations",
  "privacy",
  "editprofile",
  "feedback",
  "meetfounder",
  "synapseplus",
  "paywall",
  "healthstatus",
  "careteam", // alias into care hub — gated at carehub children, not this alias alone
]);

/**
 * Opening a Plus *hub* is allowed for discovery (Health screen pattern).
 * Opening a concrete Plus child feature requires entitlement (or preview gate).
 */
export const PLUS_DISCOVERY_HUB_KEYS = new Set([
  "feelinghub",
  "recordshub",
  "wellbeinghub",
  "carehub",
]);

export type PlusFeatureInfo = {
  key: string;
  title: string;
  summary: string;
  benefits: string[];
};

const FEATURE_COPY: Record<string, PlusFeatureInfo> = {
  feelinghub: {
    key: "feelinghub",
    title: "How I’m Feeling",
    summary: "Track mood, energy, sleep, and symptoms in one calm place.",
    benefits: ["Daily log", "Symptom episodes", "Monthly check-in"],
  },
  log: {
    key: "log",
    title: "Daily Log",
    summary: "A quick check-in for mood, energy, and sleep.",
    benefits: ["Mood & energy", "Sleep notes", "Day-to-day patterns"],
  },
  symptoms: {
    key: "symptoms",
    title: "Symptoms",
    summary: "Record symptom episodes with the details that matter to you.",
    benefits: ["Episode logging", "Severity & notes", "History over time"],
  },
  monthlycheckin: {
    key: "monthlycheckin",
    title: "Monthly Check-in",
    summary: "A fuller monthly snapshot of how you’ve been doing.",
    benefits: ["Broader review", "Trends across weeks", "Visit-ready notes"],
  },
  recordshub: {
    key: "recordshub",
    title: "Health Records",
    summary: "Vitals, labs, imaging, timeline, and reports together.",
    benefits: ["Vitals", "Lab & imaging notes", "Timeline & reports"],
  },
  healthdata: {
    key: "healthdata",
    title: "Vitals",
    summary: "Record and review blood pressure, weight, and more.",
    benefits: ["Multiple vitals", "History charts", "Apple Health import"],
  },
  labwork: {
    key: "labwork",
    title: "Lab Work",
    summary: "Keep lab results and reference ranges organized.",
    benefits: ["Results log", "Reference ranges", "Visit prep"],
  },
  imaging: {
    key: "imaging",
    title: "Imaging",
    summary: "Track scans and imaging notes in one place.",
    benefits: ["Study notes", "Dates & locations", "Easy revisit"],
  },
  timeline: {
    key: "timeline",
    title: "Timeline",
    summary: "See your health history in chronological order.",
    benefits: ["Unified timeline", "Cross-feature context", "Visit prep"],
  },
  reports: {
    key: "reports",
    title: "Reports",
    summary: "Generate visit-ready summaries from what you’ve logged.",
    benefits: ["Shareable summaries", "Selected date ranges", "Care visit prep"],
  },
  wellbeinghub: {
    key: "wellbeinghub",
    title: "Wellbeing",
    summary: "Supportive tools for everyday life — not a substitute for care.",
    benefits: ["Eating & hydration", "Comfort tools", "Gentle goals"],
  },
  eating: {
    key: "eating",
    title: "Eating & Hydration",
    summary: "Track meals and water without pressure.",
    benefits: ["Meal notes", "Hydration", "Daily awareness"],
  },
  mentalhealth: {
    key: "mentalhealth",
    title: "Mental Health Day",
    summary: "Quieter tools for harder days.",
    benefits: ["Check-ins", "Gentler pace", "Medication timing prompts"],
  },
  comfort: {
    key: "comfort",
    title: "Mood Lifters",
    summary: "Small mood lifters when you need them.",
    benefits: ["Quick comfort picks", "Saved favorites", "Low-effort support"],
  },
  goals: {
    key: "goals",
    title: "Goals",
    summary: "Gentle goals you set for yourself.",
    benefits: ["Personal goals", "Light progress", "Your pace"],
  },
  cycletracking: {
    key: "cycletracking",
    title: "Cycle Tracking",
    summary: "Optional cycle awareness with privacy controls.",
    benefits: ["Private by default", "Symptom notes", "Cycle awareness"],
  },
  ramadan: {
    key: "ramadan",
    title: "Ramadan Mode",
    summary: "Fasting-aware daily support during Ramadan.",
    benefits: ["Fasting-aware tips", "Daily log", "Gentle structure"],
  },
  checkin: {
    key: "checkin",
    title: "Check-In",
    summary: "Stay connected with people you care about.",
    benefits: ["Scheduled check-ins", "Trusted contacts", "Peace of mind"],
  },
  carehub: {
    key: "carehub",
    title: "Care & Support",
    summary: "Doctors, pharmacies, and care helpers in one place.",
    benefits: ["Care team contacts", "Pharmacies", "Care connections"],
  },
  doctors: {
    key: "doctors",
    title: "Doctors",
    summary: "Keep your care team contacts organized.",
    benefits: ["Doctor details", "Primary doctor", "Visit prep"],
  },
  pharmacies: {
    key: "pharmacies",
    title: "Pharmacies",
    summary: "Store pharmacy details for refills and questions.",
    benefits: ["Pharmacy contacts", "Notes", "Quick reference"],
  },
  careconnections: {
    key: "careconnections",
    title: "Care Connections",
    summary: "Trusted people you share selected care information with.",
    benefits: ["Trusted links", "You stay in control", "Unlink anytime"],
  },
  caregiverdashboard: {
    key: "caregiverdashboard",
    title: "Caregiver Dashboard",
    summary: "Tools for supporting someone else.",
    benefits: ["Care overview", "Important alerts", "Support workflow"],
  },
  emergency_advanced: {
    key: "emergency_advanced",
    title: "Advanced Emergency Card",
    summary: "Export, save, and share helpers on top of your free emergency card.",
    benefits: ["Export & share", "Save to Photos", "Fullscreen presentation"],
  },
};

export function requiresPlus(rawKey: string): boolean {
  const key = resolveNavKey(rawKey);
  if (!key) return false;
  if (ALWAYS_FREE_NAV_KEYS.has(key) && !PLUS_REQUIRED_NAV_KEYS.has(key)) return false;
  return PLUS_REQUIRED_NAV_KEYS.has(key);
}

/** Hubs remain open for discovery; child screens are gated. */
export function requiresPlusGate(rawKey: string): boolean {
  const key = resolveNavKey(rawKey);
  if (!key) return false;
  if (PLUS_DISCOVERY_HUB_KEYS.has(key)) return false;
  return requiresPlus(key);
}

export function getPlusFeatureInfo(rawKey: string): PlusFeatureInfo {
  const key = resolveNavKey(rawKey);
  if (FEATURE_COPY[key]) return FEATURE_COPY[key];
  return {
    key,
    title: "Synapse Plus",
    summary: "This feature is included with Synapse Plus.",
    benefits: [
      "How I’m Feeling",
      "Health Records & Wellbeing",
      "Check-In and Care & Support",
    ],
  };
}

/** Health mega-hub items that should show a Plus indicator. */
export const HEALTH_HUB_PLUS_ITEM_KEYS = new Set([
  "feelinghub",
  "recordshub",
  "wellbeinghub",
  "checkin",
  "carehub",
]);

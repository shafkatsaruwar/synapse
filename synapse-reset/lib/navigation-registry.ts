/**
 * Canonical Synapse navigation registry.
 * UI (drawer, hubs, bottom tabs) and routing should derive from this where practical.
 */
import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import { featureFlags } from "@/constants/feature-flags";

export type IconName = ComponentProps<typeof Ionicons>["name"];
export type NavDestinationType = "screen" | "hub";
export type NavRole = "self" | "caregiver" | "backup" | "any";

export type NavRegistryEntry = {
  key: string;
  type: NavDestinationType;
  label: string;
  icon: IconName;
  iconActive: IconName;
  /** Parent hub key when this is a child feature. */
  parent?: string;
  /** Show in the primary hamburger list. */
  hamburger?: boolean;
  /** Feature flag gate (compile-time). */
  requiresFlag?: keyof typeof featureFlags;
  /** Role gate for visibility. */
  role?: NavRole;
  description?: string;
};

/** Top-level hamburger order (Definition of Done). */
export const HAMBURGER_KEYS = [
  "dashboard",
  "medications",
  "appointments",
  "feelinghub",
  "recordshub",
  "wellbeinghub",
  "carehub",
  "emergencyhub",
  "accounthub",
] as const;

export const NAV_REGISTRY: NavRegistryEntry[] = [
  // —— Top-level / hubs ——
  { key: "dashboard", type: "screen", label: "Today", icon: "home-outline", iconActive: "home", hamburger: true },
  { key: "medications", type: "screen", label: "Medications", icon: "medical-outline", iconActive: "medical", hamburger: true },
  { key: "appointments", type: "screen", label: "Appointments", icon: "calendar-outline", iconActive: "calendar", hamburger: true },
  {
    key: "feelinghub",
    type: "hub",
    label: "How I’m Feeling",
    icon: "heart-outline",
    iconActive: "heart",
    hamburger: true,
    description: "Mood, energy, sleep, and symptoms—log as much or as little as you like.",
  },
  {
    key: "recordshub",
    type: "hub",
    label: "Health Records",
    icon: "folder-outline",
    iconActive: "folder",
    hamburger: true,
    description: "Vitals, labs, imaging, timeline, and reports in one place.",
  },
  {
    key: "wellbeinghub",
    type: "hub",
    label: "Wellbeing",
    icon: "leaf-outline",
    iconActive: "leaf",
    hamburger: true,
    description: "Supportive tools for everyday life. Not a substitute for professional care.",
  },
  {
    key: "carehub",
    type: "hub",
    label: "Care & Support",
    icon: "people-outline",
    iconActive: "people",
    hamburger: true,
    description: "People and places that help you manage care.",
  },
  {
    key: "emergencyhub",
    type: "screen",
    label: "Emergency",
    icon: "shield-outline",
    iconActive: "shield",
    hamburger: true,
    description: "Your emergency card — critical info when it matters.",
  },
  {
    key: "accounthub",
    type: "hub",
    label: "You & Settings",
    icon: "person-circle-outline",
    iconActive: "person-circle",
    hamburger: true,
    description: "Profile, preferences, privacy, and backup.",
  },
  /**
   * Bottom-tab Health mega-hub (not in hamburger).
   * Aggregates clinical destinations; children are listed in FeatureHubScreen.
   */
  {
    key: "health",
    type: "hub",
    label: "Health",
    icon: "fitness-outline",
    iconActive: "fitness",
    description: "Everything that helps you manage day to day.",
  },

  // —— How I’m Feeling children ——
  { key: "log", type: "screen", label: "Daily Log", icon: "heart-outline", iconActive: "heart", parent: "feelinghub", description: "Quick check-in for mood, energy, and sleep" },
  { key: "logtoday", type: "screen", label: "Daily Log", icon: "heart-outline", iconActive: "heart", parent: "feelinghub" },
  { key: "symptoms", type: "screen", label: "Symptoms", icon: "pulse-outline", iconActive: "pulse", parent: "feelinghub", description: "Record a symptom episode with details" },
  { key: "monthlycheckin", type: "screen", label: "Monthly Check-in", icon: "fitness-outline", iconActive: "fitness", parent: "feelinghub", description: "A fuller monthly snapshot" },

  // —— Health Records children ——
  { key: "healthdata", type: "screen", label: "Vitals", icon: "analytics-outline", iconActive: "analytics", parent: "recordshub", description: "Blood pressure, weight, and more" },
  { key: "labwork", type: "screen", label: "Lab Work", icon: "flask-outline", iconActive: "flask", parent: "recordshub", description: "Results and trends" },
  { key: "imaging", type: "screen", label: "Imaging", icon: "scan-outline", iconActive: "scan", parent: "recordshub", description: "Scans and imaging notes" },
  { key: "timeline", type: "screen", label: "Timeline", icon: "git-branch-outline", iconActive: "git-branch", parent: "recordshub", description: "Your health history over time" },
  { key: "reports", type: "screen", label: "Reports", icon: "bar-chart-outline", iconActive: "bar-chart", parent: "recordshub", description: "Visit-ready summaries from what you’ve logged" },
  { key: "documents", type: "screen", label: "Documents", icon: "document-outline", iconActive: "document", parent: "recordshub", requiresFlag: "documentScannerEnabled", description: "Scanned health documents" },
  { key: "insights", type: "screen", label: "Insights", icon: "sparkles-outline", iconActive: "sparkles", parent: "recordshub", requiresFlag: "documentScannerEnabled" },

  // —— Wellbeing children ——
  { key: "eating", type: "screen", label: "Eating & Hydration", icon: "restaurant-outline", iconActive: "restaurant", parent: "wellbeinghub", description: "Meals and water tracking" },
  { key: "mentalhealth", type: "screen", label: "Mental Health Day", icon: "heart-outline", iconActive: "heart", parent: "wellbeinghub", description: "Quieter tools for harder days" },
  { key: "comfort", type: "screen", label: "Mood Lifters", icon: "happy-outline", iconActive: "happy", parent: "wellbeinghub", description: "Small mood lifters when you need them" },
  { key: "goals", type: "screen", label: "Goals", icon: "flag-outline", iconActive: "flag", parent: "wellbeinghub", description: "Gentle goals you set for yourself" },
  { key: "cycletracking", type: "screen", label: "Cycle Tracking", icon: "water-outline", iconActive: "water", parent: "wellbeinghub", description: "Optional cycle awareness" },
  { key: "ramadan", type: "screen", label: "Ramadan Mode", icon: "moon-outline", iconActive: "moon", parent: "wellbeinghub", description: "Fasting-aware daily support" },
  { key: "ramadandailylog", type: "screen", label: "Ramadan Daily Log", icon: "moon-outline", iconActive: "moon", parent: "wellbeinghub" },

  // —— Care & Support children ——
  { key: "doctors", type: "screen", label: "Doctors", icon: "medkit-outline", iconActive: "medkit", parent: "carehub", description: "Your care team contacts" },
  { key: "pharmacies", type: "screen", label: "Pharmacies", icon: "storefront-outline", iconActive: "storefront", parent: "carehub", description: "Pharmacy details" },
  { key: "caregiverdashboard", type: "screen", label: "Caregiver Dashboard", icon: "people-outline", iconActive: "people", parent: "carehub", role: "caregiver", description: "Tools for supporting someone else" },
  { key: "managedperson", type: "screen", label: "Managed Person", icon: "accessibility-outline", iconActive: "accessibility", parent: "carehub", role: "caregiver", description: "Details for the person you support" },

  // —— Account children ——
  { key: "healthprofile", type: "screen", label: "Health Profile", icon: "person-outline", iconActive: "person", parent: "accounthub", description: "Basics about you" },
  { key: "healthprofileconditions", type: "screen", label: "Conditions", icon: "clipboard-outline", iconActive: "clipboard", parent: "accounthub", description: "Conditions that matter for your care" },
  { key: "allergy", type: "screen", label: "Allergies", icon: "alert-circle-outline", iconActive: "alert-circle", parent: "accounthub", description: "Allergies and sensitivities" },
  { key: "settings", type: "screen", label: "Preferences", icon: "options-outline", iconActive: "options", parent: "accounthub", description: "Appearance, mode, notifications, and account" },
  { key: "privacy", type: "screen", label: "Privacy", icon: "lock-closed-outline", iconActive: "lock-closed", parent: "accounthub", description: "Local-first defaults and app lock" },
  { key: "editprofile", type: "screen", label: "Backup & Restore", icon: "cloud-outline", iconActive: "cloud", parent: "accounthub", description: "Optional iCloud backup and local export" },
  { key: "feedback", type: "screen", label: "Help & Feedback", icon: "chatbubble-ellipses-outline", iconActive: "chatbubble-ellipses", parent: "accounthub", description: "Share feedback or get help" },
  { key: "meetfounder", type: "screen", label: "Meet the Founder", icon: "heart-outline", iconActive: "heart", parent: "accounthub" },
  { key: "auth", type: "screen", label: "Sign In", icon: "log-in-outline", iconActive: "log-in", parent: "accounthub" },

  // —— Other retained screens (not hamburger children) ——
  { key: "healthstatus", type: "screen", label: "Health Status", icon: "pulse-outline", iconActive: "pulse" },
  { key: "sickmode", type: "screen", label: "Sick Mode", icon: "medkit-outline", iconActive: "medkit" },
];

/** Legacy / deep-link aliases → canonical key. */
export const NAV_ALIASES: Record<string, string> = {
  home: "dashboard",
  today: "dashboard",
  dailylog: "log",
  "daily-log": "log",
  notes: "logtoday",
  labs: "labwork",
  "sick-mode": "sickmode",
  "monthly-review": "monthlycheckin",
  hydration: "eating",
  // Former mega-hub / intermediate keys → new hubs
  feeling: "feelinghub",
  healthrecords: "recordshub",
  wellbeing: "wellbeinghub",
  caresupport: "carehub",
  you: "accounthub",
  // Emergency Protocol removed — card is the one destination
  emergency: "emergencyhub",
  emergencycard: "emergencyhub",
  // "health" is the bottom-tab mega-hub (canonical key in NAV_REGISTRY)
  accountHub: "accounthub",
  account: "accounthub",
};

const BY_KEY = new Map(NAV_REGISTRY.map((e) => [e.key, e]));

export function resolveNavKey(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return trimmed;
  const aliased = NAV_ALIASES[trimmed] ?? NAV_ALIASES[trimmed.toLowerCase()] ?? trimmed;
  return aliased;
}

export function getNavEntry(key: string): NavRegistryEntry | undefined {
  return BY_KEY.get(resolveNavKey(key));
}

export function isKnownNavKey(key: string): boolean {
  const resolved = resolveNavKey(key);
  return BY_KEY.has(resolved);
}

export function getParentHub(key: string): string | undefined {
  return getNavEntry(key)?.parent;
}

export function getHubChildren(
  hubKey: string,
  options?: { role?: string; includeFlagged?: boolean }
): NavRegistryEntry[] {
  const role = options?.role ?? "self";
  return NAV_REGISTRY.filter((entry) => {
    if (entry.parent !== hubKey) return false;
    if (entry.key === "logtoday") return false; // alias of log for UI lists
    if (entry.requiresFlag && !featureFlags[entry.requiresFlag]) return false;
    if (entry.role && entry.role !== "any" && entry.role !== role) return false;
    return true;
  });
}

export function getHamburgerItems(options?: { role?: string }): NavRegistryEntry[] {
  return HAMBURGER_KEYS.map((key) => BY_KEY.get(key)!).filter(Boolean);
}

/** Bottom tab destinations for Full Mode — Today / Health / You. */
export const FULL_BOTTOM_TAB_KEYS = ["dashboard", "health", "accounthub"] as const;

/** Bottom tab destinations for Simple Mode. */
export const SIMPLE_BOTTOM_TAB_KEYS = ["dashboard", "medications", "appointments", "feelinghub", "accounthub"] as const;

/** Destinations that highlight the Health bottom tab when open. */
const HEALTH_TAB_SCREENS = new Set([
  "health",
  "medications",
  "appointments",
  "feelinghub",
  "recordshub",
  "wellbeinghub",
  "carehub",
]);

export function primaryTabForScreen(screen: string): string {
  const resolved = resolveNavKey(screen);
  if ((FULL_BOTTOM_TAB_KEYS as readonly string[]).includes(resolved)) return resolved;
  if (resolved === "sickmode" || resolved === "healthstatus") return "dashboard";
  const parent = getParentHub(resolved);
  if (resolved === "emergencyhub") return "dashboard";
  if (parent === "accounthub") return "accounthub";
  if (HEALTH_TAB_SCREENS.has(resolved)) return "health";
  if (
    parent === "feelinghub" ||
    parent === "recordshub" ||
    parent === "wellbeinghub" ||
    parent === "carehub"
  ) {
    return "health";
  }
  return "dashboard";
}

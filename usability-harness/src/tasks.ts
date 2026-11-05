import { fictional } from "./fictional.js";
import type { TaskId, UsabilityTask } from "./types.js";

/**
 * Task briefs given to the vision agent. Goals are written in user language only.
 * Controllers may use automation selectors separately; the agent must not rely on them.
 */
export const TASKS: UsabilityTask[] = [
  {
    id: "onboarding",
    title: "Complete onboarding",
    goal: "Finish the first-run setup so you can use the main app. Use the fictional name if asked. Skip real sign-in, purchases, and notification permission if you can.",
    successCriteria: [
      "Onboarding / welcome flow is no longer showing",
      "A home / today-style main screen is visible",
    ],
    maxSteps: 25,
    fictionalInputs: {
      name: fictional.preferredName,
      fullName: fictional.personaName,
    },
  },
  {
    id: "add_medication",
    title: "Add a sample medication and reminder",
    goal: `Add a fictional medication named "${fictional.medication.name}" (${fictional.medication.dose}, ${fictional.medication.frequency} at ${fictional.medication.time}) and set a reminder if the app offers one. Do not scan a real label or use real pharmacy accounts.`,
    successCriteria: [
      "Medication name appears in a list or confirmation",
      "A reminder/schedule was accepted or clearly skipped with the med saved",
    ],
    maxSteps: 35,
    fictionalInputs: {
      medicationName: fictional.medication.name,
      dose: fictional.medication.dose,
      frequency: fictional.medication.frequency,
      time: fictional.medication.time,
      notes: fictional.medication.notes,
    },
  },
  {
    id: "add_appointment",
    title: "Add a doctor's appointment",
    goal: `Schedule a fictional appointment: "${fictional.appointment.title}" at ${fictional.appointment.location}. Use any future date the UI offers. Do not import a real calendar account if Skip is available.`,
    successCriteria: [
      "Appointment title or doctor name is visible as saved/upcoming",
    ],
    maxSteps: 30,
    fictionalInputs: {
      title: fictional.appointment.title,
      doctor: fictional.appointment.doctor,
      location: fictional.appointment.location,
      notes: fictional.appointment.notes,
    },
  },
  {
    id: "find_emergency_card",
    title: "Find the Emergency Card",
    goal: "Locate the Emergency Card screen from wherever you are. Open it and confirm you can see critical-info style fields (even if empty).",
    successCriteria: [
      "A screen clearly labeled Emergency Card (or equivalent) is visible",
    ],
    maxSteps: 20,
  },
  {
    id: "use_sick_mode",
    title: "Locate and use Sick Mode",
    goal: "Find Sick Mode / recovery mode, turn it on if offered, look around briefly, then turn it off / mark that you feel better if that option exists. Do not message caregivers for real.",
    successCriteria: [
      "Sick Mode or recovery UI was opened",
      "Mode was activated or a clear activation control was exercised",
    ],
    maxSteps: 25,
  },
  {
    id: "health_records_plus",
    title: "Find health records and identify Plus restrictions",
    goal: "Find Health Records (vitals, labs, imaging, timeline, or reports). Note any Synapse Plus / upgrade / lock messaging that appears for a free user. Do not complete a purchase.",
    successCriteria: [
      "Reached a health records related area",
      "Recorded whether Plus restrictions/badges/paywall cues are visible",
    ],
    maxSteps: 25,
  },
  {
    id: "recover_wrong_tap",
    title: "Recover from an incorrect tap",
    goal: "Deliberately open something that is NOT the appointments list (for example Settings, a different hub, or a detail you did not need). Then recover back to a familiar main screen without restarting the app.",
    successCriteria: [
      "An intentional wrong destination was opened",
      "User recovered to Home/Today or another clear main hub using visible back/cancel/nav",
    ],
    maxSteps: 20,
  },
  {
    id: "subscription_pricing",
    title: "Locate subscription pricing and restore purchases",
    goal: "Find Synapse Plus / subscription pricing so monthly/yearly/lifetime (or similar) prices are visible. Locate Restore Purchases if shown. Do NOT confirm Buy/Subscribe/Purchase. Viewing the paywall and restore control is enough.",
    successCriteria: [
      "Pricing options or paywall is visible",
      "Restore Purchases control was located (tapping restore is OK; buying is not)",
    ],
    maxSteps: 25,
  },
];

export function getTask(id: TaskId): UsabilityTask {
  const task = TASKS.find((t) => t.id === id);
  if (!task) throw new Error(`Unknown task: ${id}`);
  return task;
}

export const ALL_TASK_IDS: TaskId[] = TASKS.map((t) => t.id);

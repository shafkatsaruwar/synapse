/**
 * Check-In wording. Routine, warm, and never accusatory: a caregiver's phone only knows a saved
 * schedule and the last shared update, so nothing here says a dose was missed or not taken.
 */
import type { ReminderPostponement } from "./checkin-schedule";

export type CheckInTopic = "medication" | "appointment" | "wellness";
export type CheckInDirection = "send" | "check_on";

export const CHECKIN_TOPICS: { id: CheckInTopic; label: string; icon: "medkit-outline" | "calendar-outline" | "heart-outline" }[] = [
  { id: "medication", label: "Medication", icon: "medkit-outline" },
  { id: "appointment", label: "Appointment", icon: "calendar-outline" },
  { id: "wellness", label: "Wellness", icon: "heart-outline" },
];

const TEMPLATES: Record<CheckInDirection, Record<CheckInTopic, string>> = {
  send: {
    medication: "Hey! Just letting you know I've taken my medication. All good.",
    appointment: "Hey! Just wanted to update you about my appointment.",
    wellness: "Hey! Just checking in to let you know I'm doing okay.",
  },
  check_on: {
    medication: "Hey! Just checking in. Have you had a chance to take your medication?",
    appointment: "Hey! How did your appointment go?",
    wellness: "Hey! Just wanted to see how you're doing today.",
  },
};

export function checkInTemplate(direction: CheckInDirection, topic: CheckInTopic): string {
  return TEMPLATES[direction][topic];
}

/** Anything that sounds like surveillance, blame, or a status claim we cannot know. */
export const FORBIDDEN_WORDING = /\b(missed|miss(ed)? (his|her|their|a) dose|didn'?t take|did not take|failed|failure|forgot|forgotten|overdue|non-?complian|delinquent|late on)\b/i;

export function reminderTitle(name: string): string {
  return `A little check-in with ${name}?`;
}

export function reminderBody(name: string, topic: CheckInTopic, postponement: ReminderPostponement | null): string {
  if (topic === "medication") {
    return postponement
      ? `It was around the time ${name} usually takes medication, during your quiet hours. A little check-in when you're ready?`
      : `It's around the time ${name} usually takes medication. Would you like to check in?`;
  }
  return `A gentle nudge to check in with ${name}.`;
}

/** Plain-language explanation shown in the app when quiet hours moved a reminder. */
export function postponementExplanation(name: string): string {
  return `${name}'s medication time falls during your quiet hours. We'll remind you when your quiet hours end. This is a reminder from the saved schedule, not a live medication update.`;
}

export function pickDoseWord(count: number): string {
  return count === 1 ? "1 reminder" : `${count} reminders`;
}

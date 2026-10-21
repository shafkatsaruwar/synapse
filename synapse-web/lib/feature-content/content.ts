import { APP_STORE_URL } from "@/lib/design-tokens/tokens";

export type FeatureSlug =
  | "medications"
  | "appointments"
  | "health-records"
  | "how-im-feeling"
  | "sick-mode"
  | "emergency";

export type FeatureLayout = "split" | "overlap" | "stack" | "quote" | "quiet" | "card";

export type FeatureContent = {
  slug: FeatureSlug;
  nav: string;
  eyebrow: string;
  title: string;
  lede: string;
  explanation: string[];
  steps: { title: string; body: string }[];
  benefits: string[];
  privacy: string;
  layout: FeatureLayout;
  screen: "medications" | "appointments" | "records" | "feeling" | "sick" | "emergency";
  caption: string;
};

export const features: FeatureContent[] = [
  {
    slug: "medications",
    nav: "Medications",
    eyebrow: "Medications",
    title: "A little less to remember.",
    lede: "Schedules, doses, reminders, and the details that belong with a medication — kept together.",
    explanation: [
      "Synapse stores the medications you add on this device. Each one can be scheduled or as-needed. A schedule can repeat daily, weekly, every two weeks, or on a custom interval.",
      "A dose can include an amount, a unit, a time of day, and a reminder time. On iPhone, reminders are local notifications. A reminder can include actions to mark a dose taken or to snooze it for 10 minutes.",
      "You can also keep route, pharmacy, and refill details with the medication, and mark doses from the medication list or from Today.",
    ],
    steps: [
      { title: "Add what you take", body: "Create a medication and choose scheduled or as-needed." },
      { title: "Set the rhythm", body: "Add the dose, the time of day, and a reminder if you want one." },
      { title: "Mark it taken", body: "Log a dose from the list, from Today, or from the reminder." },
      { title: "Keep the details", body: "Route, pharmacy, and refills stay with that medication." },
    ],
    benefits: [
      "Daily, weekly, every-two-weeks, or custom schedules",
      "Dose logging, including as-needed doses",
      "Local reminders with mark-taken and a 10-minute snooze",
      "Amount, unit, route, pharmacy, and refill details in one place",
      "Today’s doses gathered on the home screen",
    ],
    privacy:
      "Medication names and dose logs stay on this device unless you export a file or turn on an optional feature you choose, such as a signed-in cloud copy. Synapse does not sell health data to advertisers.",
    layout: "split",
    screen: "medications",
    caption: "A fictional medication list, showing schedules and doses you would enter yourself.",
  },
  {
    slug: "appointments",
    nav: "Appointments",
    eyebrow: "Appointments",
    title: "Feel ready for what’s next.",
    lede: "Visits, notes, and the practical details — in a list you can actually look at before you go.",
    explanation: [
      "You can add appointments, mark them done or missed, and repeat them weekly, every two weeks, monthly, or on a custom schedule. A visit can hold the clinician, the place, and notes you want with you.",
      "On iPhone you can import events from Apple Calendar, or open a .ics file and preview it before anything is saved. Calendar access for import is read-only. Synapse writes to Calendar only when you choose to export a visit.",
      "When a visit has a location, iPhone can show a leave-by travel estimate. Visits are not pulled from a clinic or patient portal on their own.",
    ],
    steps: [
      { title: "Add a visit", body: "Create one yourself, or import from Apple Calendar or a calendar file." },
      { title: "Bring the context", body: "Add the clinician, the place, and notes for the visit." },
      { title: "See it on Today", body: "The next appointment can surface on the home screen." },
      { title: "Leave on time", body: "On iPhone, a location can include a leave-by estimate." },
    ],
    benefits: [
      "Upcoming, today, and past visits",
      "Repeating visits",
      "Clinician, location, and notes together",
      "Apple Calendar import and .ics import with a preview",
      "A leave-by travel estimate on iPhone when a place is set",
    ],
    privacy:
      "Appointment details stay on this device unless you export them or use an optional account feature you turn on. Importing from Calendar reads events you choose. It does not sync with a healthcare provider.",
    layout: "overlap",
    screen: "appointments",
    caption: "A fictional upcoming visit. Names, places, and times are sample data.",
  },
  {
    slug: "health-records",
    nav: "Health Records",
    eyebrow: "Health Records",
    title: "The details that matter. Within reach.",
    lede: "Labs, imaging, conditions, and allergies you decide to keep. Not a live link to your providers.",
    explanation: [
      "Health records in Synapse are information you enter. A lab entry can include the test, values, units, and notes such as a reference range. Imaging studies are records you keep in the same spirit.",
      "Your health profile holds conditions and allergies. A timeline can show the entries you have stored, in order.",
      "Synapse does not automatically sync with hospitals, clinics, or patient portals. A document scanner exists in the codebase behind a switch that is off in this version, so scanning is not part of the product you download today.",
    ],
    steps: [
      { title: "Add a result", body: "Record a lab or imaging study when you have one you want to keep." },
      { title: "Note what matters", body: "Keep conditions and allergies on your health profile." },
      { title: "Read it back", body: "Open the timeline when you want the sequence of what you’ve stored." },
      { title: "Take a copy", body: "Export a file if you want a copy you control." },
    ],
    benefits: [
      "Lab results with values, units, and notes",
      "Imaging studies you record yourself",
      "Conditions and allergies on your profile",
      "A timeline of entries stored in the app",
      "A file export of what you have saved",
    ],
    privacy:
      "These records stay on the device by default. Nothing is fetched from a provider. An export is a JSON file you choose to share — treat it like a medical record. It is not marketed as encrypted.",
    layout: "stack",
    screen: "records",
    caption: "Fictional lab entries you would type or keep yourself. Not a provider feed.",
  },
  {
    slug: "how-im-feeling",
    nav: "How I’m Feeling",
    eyebrow: "How I’m Feeling",
    title: "Every day tells a story.",
    lede: "A daily check-in for how you feel, and symptoms you want to remember later.",
    explanation: [
      "The daily log asks for an overall feeling, then fatigue, energy, mood, and sleep, on a simple scale. You can add a note about the day.",
      "Symptoms can be logged on their own screen, with a name, a severity, and an optional note, and looked at over time.",
      "Today can reflect the check-in you saved. This is a record of what you report. It does not diagnose a condition or recommend treatment.",
    ],
    steps: [
      { title: "Open the daily log", body: "Check in when you want to, not on a schedule the app demands." },
      { title: "Mark the day", body: "Set overall feeling, fatigue, energy, mood, and sleep." },
      { title: "Add a symptom", body: "Log a symptom separately when you want it tracked over time." },
      { title: "See today", body: "The home screen can show that you have checked in." },
    ],
    benefits: [
      "Overall feeling, fatigue, energy, mood, and sleep",
      "A note for the day",
      "Symptom logs with severity over time",
      "A home screen that can reflect today’s check-in",
      "Your words, not a diagnosis",
    ],
    privacy:
      "Check-ins and symptom notes stay on this device unless you export them or enable an optional feature. They are not sent anywhere for the sake of the daily log itself.",
    layout: "quote",
    screen: "feeling",
    caption: "A fictional daily check-in. The sliders match the daily log in the app.",
  },
  {
    slug: "sick-mode",
    nav: "Sick Mode",
    eyebrow: "Sick Mode",
    title: "A little more support on the harder days.",
    lede: "A calmer screen for rest, simple logs, and gentle check-ins. Not a diagnosis, and not a treatment.",
    explanation: [
      "Sick Mode is a reduced-stress surface you turn on. It keeps the focus on resting and on a few low-effort logs: temperature, hydration, food, and rest.",
      "While it is on, Synapse can prompt a short check-in. You can switch to a recovering state, which pauses those check-ins without erasing what you logged. Ending Sick Mode stops the active check-ins. Temperatures, medication logs, and the session stay saved.",
      "The screen reminds you to seek urgent care yourself for severe symptoms, and to contact a clinician when you are not improving. Synapse does not diagnose, treat, or contact emergency services.",
    ],
    steps: [
      { title: "Turn it on", body: "Open Sick Mode when a day needs a quieter set of tools." },
      { title: "Log lightly", body: "Temperature, fluids, food, and rest — only what you want to record." },
      { title: "Pause if you need", body: "Recovering pauses check-ins and keeps the logs." },
      { title: "End it yourself", body: "Leave Sick Mode when you are ready. What you logged remains." },
    ],
    benefits: [
      "A calmer layout on harder days",
      "Temperature, hydration, food, and rest logs",
      "Gentle check-ins you can pause",
      "Logs that remain after you end the session",
      "A reminder to get real-world care when symptoms are severe",
    ],
    privacy:
      "Sick Mode logs are stored with the rest of your on-device data. Turning the mode off does not delete them. Synapse will not call anyone for you.",
    layout: "quiet",
    screen: "sick",
    caption: "Fictional Sick Mode. Sample numbers only — not a reading from a real person.",
  },
  {
    slug: "emergency",
    nav: "Emergency",
    eyebrow: "Emergency",
    title: "Important information. When it matters.",
    lede: "An emergency card you fill in, and instructions you write. Synapse does not contact emergency services for you.",
    explanation: [
      "The emergency card is a summary you create: name, date of birth, allergies, medications, an emergency contact, a doctor, and notes. You can share it or save an image when you choose.",
      "Emergency protocol is a separate place for step-by-step instructions you write, and for contacts you have saved. Tapping a phone number can open your phone’s dialer. Placing the call is up to you.",
      "Synapse does not detect an emergency, and it does not contact emergency services on its own.",
    ],
    steps: [
      { title: "Fill in the card", body: "Add the details you want someone to see." },
      { title: "Write your steps", body: "Keep personal instructions in Emergency Protocol if you want them." },
      { title: "Share it yourself", body: "Share the card or save an image when you decide to." },
      { title: "Call if you need to", body: "A saved number can open the dialer. You place the call." },
    ],
    benefits: [
      "A card for allergies, medications, contacts, and notes",
      "A doctor and an emergency contact you enter",
      "Instructions you write in your own words",
      "Share or save the card when you choose",
      "Phone links that open the dialer, and stop there",
    ],
    privacy:
      "The card is stored on this device with your other Synapse data. Sharing it creates a copy you are handing to someone else. Synapse does not publish it.",
    layout: "card",
    screen: "emergency",
    caption: "A fictional emergency card. Every name and number on it is made up.",
  },
];

export function featureBySlug(slug: string) {
  return features.find((feature) => feature.slug === slug);
}

export const demo = {
  person: "Alex Rivera",
  dob: "April 2, 1992",
  meds: [
    { name: "Lisinopril", dose: "10 mg", when: "Morning", state: "Taken" },
    { name: "Vitamin D", dose: "1000 IU", when: "Morning", state: "Taken" },
    { name: "Cetirizine", dose: "10 mg", when: "Evening", state: "Due" },
  ],
  appointment: {
    when: "Thursday · 2:30 PM",
    who: "Dr. Elena Cho",
    where: "Harbor Clinic",
    note: "Bring the questions you wrote down.",
  },
  feeling: [
    { label: "Overall", value: "Okay" },
    { label: "Energy", value: "Good" },
    { label: "Mood", value: "Okay" },
    { label: "Sleep", value: "High" },
  ],
  labs: [
    { name: "Hemoglobin", value: "13.4 g/dL", note: "Reference noted by you" },
    { name: "Vitamin D", value: "32 ng/mL", note: "Drawn in March" },
  ],
  allergies: "Penicillin",
  contact: { name: "Jordan Lee", phone: "(555) 010-0198" },
  doctor: { name: "Dr. Elena Cho", phone: "(555) 010-0144" },
};

export const story = {
  name: "Mohammed Shafkat Saruwar",
  role: "Building Synapse Health",
  quote:
    "I built Synapse Health to make managing your health feel calm — not like a chore.",
  paragraphs: [
    "Synapse started as a personal health companion: medications, appointments, and a daily check-in, in a place that tries to stay quiet.",
    "The app keeps health logs on the device by default. An account is optional, for when you want sign-in or a cloud copy you turn on yourself. There is no separate public biography beyond what the app’s Meet the Founder screen already says.",
  ],
  points: [
    "Daily logs you can actually read back",
    "Medication tracking that stays simple",
    "Emergency information you choose to keep",
    "Local-first storage, with optional cloud only when you use it",
  ],
};

export const supportFaqs = [
  {
    q: "How do I get started?",
    a: "Synapse opens with a short first-run introduction. After that, Today is home. You can add a medication, a visit, or a daily check-in whenever you want. A guided tour can be opened again from Account.",
  },
  {
    q: "How do medication reminders work?",
    a: "Add a medication, set it as scheduled, and give a dose a reminder time. On iPhone, Synapse schedules a local notification. The notification can include Mark as Taken and Snooze for 10 minutes. Reminders need notification permission, which the system asks for.",
  },
  {
    q: "How do I back up or restore?",
    a: "Use Backup & Restore in the app to export a JSON file, or restore from a Synapse export. Restoring replaces what is currently stored on that device. Automatic iCloud backup is turned off in this version — the CloudKit code is present, but the feature flag is disabled because the production schema is not ready. File export and restore still work.",
  },
  {
    q: "Where does my information live?",
    a: "On the device, by default. You can export it, delete it, or turn on optional tools such as sign-in, a cloud copy for assistant access, caregiver linking, or Apple Health import. Those run when you use them. See Privacy for the longer account.",
  },
  {
    q: "Which permissions does the iPhone app ask for?",
    a: "Face ID, if you turn on App Lock. Apple Health, only to read vitals you choose to import — Synapse does not write to Apple Health in this version. Calendar, to import events, and to add an event only when you export one. Photos, when you choose an image or save one.",
  },
  {
    q: "How do I reach someone?",
    a: "The app has a Feedback screen. What you submit is saved on the device; the source does not publish a support email, and that form is not a public inbox. For the published app, use the App Store listing.",
  },
];

export { APP_STORE_URL };

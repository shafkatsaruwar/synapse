# Add Medication

Detail reference for the **Add Medication** flow in Synapse.

**Primary implementation:** `synapse-reset/screens/MedicationsScreen.tsx`  
**Data model:** `synapse-reset/lib/storage.ts` (`Medication`, `MedicationDose`)  
**Scheduling helpers:** `synapse-reset/lib/medication-schedule.ts`  
**Scan import:** `synapse-reset/screens/VisualScanImportModal.tsx`

---

## What it is

Add Medication is the entry point for creating a medication record in Synapse. It lives on the **Medications** screen (`screens` → Medications) and opens from the **Add Med** control (or programmatically from the dashboard / caregiver quick actions).

It is a modal form (full or simple mode) that collects medication identity, dosing, schedule, and optional care details, then persists a `Medication` object to local storage. The same modal doubles as **Edit Medication** when an existing card is opened.

There is also a parallel path: **Scan medication**, which opens `VisualScanImportModal` with `initialType="medication"` to OCR/parse a label or photo into a medication draft.

---

## What it does

When you add a medication, Synapse:

1. **Opens a create modal** — simple stepped flow in Simple Mode, or the full form otherwise.
2. **Collects core fields** — name, type (scheduled vs as-needed/PRN), dose amount(s), units, and time-of-day.
3. **Builds a structured `Medication` record** with one or more `MedicationDose` entries.
4. **Saves** via `medicationStorage.save()` (or `update()` when editing).
5. **Syncs side effects** — notification schedules (`syncAllFromSettings`), home-screen widget snapshot (`syncWidgetSnapshot`), and product milestones (`first_medication_configured`, `first_useful_action`) on first add.
6. **Optionally logs a PRN dose immediately** when a new as-needed med is saved (`medicationLogStorage.logPrnDose`).
7. Reloads the Medications list so the new med appears under the right time-of-day group (or the PRN section).

### Entry points

| Entry | Behavior |
| --- | --- |
| Medications header **Add Med** | Opens add modal for the current user |
| Medications header **Scan** icon | Opens visual scan import for medications |
| Dashboard / Quick Add | Can open Simple Add via `simpleOpenAddToken` |
| Caregiver dashboard **Add medication** | Opens add flow with `entryOwner = care_recipient` |
| Empty state copy | Points users to **Add Med** |

---

## What it can do

### Medication types

- **Scheduled** — taken at specific times of day, with reminder times and a repeat cadence.
- **As Needed (PRN)** — no fixed daily schedule; can be logged when taken. New PRN adds can “Log and Save” in one step.

### Identity and presentation

- Medication **name** (required)
- Optional **photo** of the bottle/box/pill (photo library)
- Optional **emoji** (or auto-emoji from route keywords such as tablet, injection, inhaler)
- Optional pull from an existing **med list** name (autocomplete dropdown when med-list items exist)

### Dosing

- One or more independent doses, each with:
  - **Amount** and **unit** (e.g. `10` + `mg`)
  - **Time of day** — Morning, Afternoon, Night; plus Before Fajr / After Iftar when Ramadan Mode is on; PRN uses “As Needed”
  - **Reminder time** (HH:mm) per dose for scheduled meds
  - Optional **per-dose notes**
- Full form supports **+ Add Dose** for multi-dose regimens
- Simple Mode maps one amount/unit across the selected time-of-day chips and assigns default reminder times per tag

### Ownership (caregiver)

- When the profile is a caregiver with a cared-for person, Add Medication can choose **who the med is for**: You or the care recipient (`entryOwner`: `self` | `care_recipient`)
- Owner step appears in Simple Mode when both options exist; caregiver quick-add can skip straight to the care-recipient owner

### Scheduling and reminders (scheduled only)

- Reminder cadence: **Every day**, **Every week**, **Every 2 weeks**, or **Custom** (every N days/weeks)
- Weekday picker for weekly / biweekly / custom-weeks schedules
- Per-dose reminder clock times used by the notification scheduler
- Frequency label is derived from cadence (e.g. “As Needed” for PRN)

### Care context (scheduled only, optional)

- **Route** (tablet, injection, inhaler, etc.)
- **Prescribing doctor** — pick from doctors filtered by owner, or add a doctor inline
- **Pharmacy** — link to a saved pharmacy (name/phone/address/hospital copied onto the medication)
- **Refill / supply tracking**
  - Inventory unit (e.g. Pills, mL)
  - Current supply on hand
  - Refills remaining
  - Amount per refill
  - Supply used each dose
  - Low-supply warning threshold
  - Optional concentration (mg/mL) when tracking liquids so mg doses can convert to mL
- **Sick day / stress dose** protocol
  - Toggle for a different dose when sick
  - Stress amount, frequency, optional duration (days), optional special instructions

### Simple Mode stepped flow

Typical steps (owner step only when needed):

0. **Who is this for?** (caregiver)
1. **Type** — Scheduled vs As Needed
2. **Name**
3. **Dose** — amount, unit, and (if scheduled) time-of-day chips  
   Then **Save** / **Log and Save**

Photo attach is available in the simple modal as well.

### Full form capabilities

Everything in Simple Mode, plus multi-dose editing, explicit reminder times, cadence, route, doctor, pharmacy, refill inventory, stress-dose protocol, and optional PRN “add more details” after a quick log-and-save.

### Scan import

From the Medications screen scan button:

- Capture / import medication label text or image
- Parse into name/dosage fields
- Review and save as an added medication (`source` can be `"scan"`)

### After save: what the medication enables elsewhere

Once added, the medication can:

- Appear on the **Medications** screen grouped by time of day (or PRN list)
- Support **dose taken / not yet** logging and gentle nudge UI
- Drive **local reminders** via the notification manager
- Update the **iOS/widget snapshot** of today’s meds
- Track **supply / refill warnings** on the med card
- Participate in **Sick Mode / recovery** stress-dose display when configured
- Be owned by self or care recipient for **caregiver** views
- Be edited or deleted later from the same screen (delete cancels reminders and related logs)

---

## Data saved (`Medication`)

Key fields written by Add Medication:

| Field | Purpose |
| --- | --- |
| `name` | Display name |
| `imageUri` | Optional photo URI |
| `medicationType` | `"scheduled"` \| `"prn"` |
| `frequency` | Human-readable schedule label |
| `doses[]` | Amount, unit, timeOfDay, reminderTime, notes |
| `route` | Administration route (scheduled) |
| `emoji` | Custom or auto icon |
| `doctorId` | Linked prescriber |
| `pharmacyId` / pharmacy name fields | Linked pharmacy snapshot |
| `reminderCadence` / weekday / interval | Repeat schedule |
| `currentSupplyAmount`, `refillsRemaining`, `amountPerRefill`, `supplyPerDose`, `lowSupplyThreshold`, `inventoryUnit`, `concentrationMgPerMl` | Inventory |
| `hasStressDose` + stress dose fields | Sick-day protocol |
| `entryOwner` | Self vs care recipient |
| `active` | Always `true` on add |

Legacy fields (`dosage`, `unit`, `timeTag`, numeric `doses` count, `pillsRemaining`, etc.) are still normalized via `normalizeMedication()` for older records.

---

## Validation rules (save)

- Name must be non-empty
- At least one dose with a non-empty amount
- Scheduled doses require a reminder time each
- Custom cadence requires a valid interval ≥ 1
- Simple Mode step gates: type selected → name → amount/unit (+ at least one time for scheduled)

---

## Related UI on the same screen (not the Add form itself)

These live on Medications but are separate from Add Medication:

- Daily dose logging and “Not yet” nudge
- PRN log modal (reason/notes)
- Med list CRUD (reference list with duration/refills)
- Sick Mode hydration / temperature / symptom checklists when recovery is active
- Medication enforcement card

---

## File map

```text
synapse-reset/screens/MedicationsScreen.tsx   # Add / Edit modal, simple + full flows
synapse-reset/screens/VisualScanImportModal.tsx
synapse-reset/lib/storage.ts                  # Medication model + medicationStorage
synapse-reset/lib/medication-schedule.ts      # Cadence / due-day helpers
synapse-reset/lib/notification-manager.ts     # Reminder sync after save
synapse-reset/lib/widget-sync.ts              # Widget snapshot after save
synapse-reset/app/(tabs)/index.tsx            # Quick-open tokens for Add Medication
```

---

## Summary

**Add Medication** is how Synapse turns a prescribed or as-needed drug into a tracked, remindable, optionally refill-aware record. It can create simple one-dose entries in a few taps, or fully specified multi-dose regimens with doctors, pharmacies, schedules, inventory, and sick-day dosing — including caregiver ownership and label scan import.

# Add Appointment

Detail reference for the **Add Appointment** flow in Synapse.

**Primary implementation:** `synapse-reset/screens/AppointmentsScreen.tsx`  
**Data model:** `synapse-reset/lib/storage.ts` (`Appointment`)  
**Travel estimate helper:** `synapse-reset/lib/appointment-travel.ts`  
**Scan import:** `synapse-reset/screens/VisualScanImportModal.tsx`  
**Calendar import:** `synapse-reset/screens/AppleCalendarImportModal.tsx`  
**ICS preview path:** `synapse-reset/screens/IcsImportPreviewScreen.tsx`

---

## What it is

Add Appointment is the entry point for creating a visit / appointment record in Synapse. It lives on the **Appointments** screen (`screens` → Appointments) and opens from the header **+** control when the Calendar tab is active (or programmatically from dashboard Quick Add via `simpleOpenAddToken`).

It is a modal form (full **New Appointment** form, or a stepped **Add Appointment** flow in Simple Mode) that collects who the visit is with, when it is, and optional care details, then persists an `Appointment` object to local storage. The same modal doubles as **Edit Appointment** when an existing visit is edited.

Parallel create paths:

- **Scan appointment card** — `VisualScanImportModal` with `initialType="appointment"`
- **Import from Apple Calendar** — `AppleCalendarImportModal`
- **ICS / file import** — preview screen that can also **Add Appointment** after review

---

## What it does

When you add an appointment, Synapse:

1. **Opens a create modal** — simple stepped flow in Simple Mode, or the full form otherwise.
2. **Collects core fields** — doctor (name or linked doctor record), date, time, and optional notes / ownership.
3. **Builds a structured `Appointment` record**, copying specialty and location from the selected doctor in the full form.
4. **Saves** via `appointmentStorage.save()` (or `update()` when editing).
5. **Expands recurring series** when Repeat is set — creates the first occurrence plus future instances (default horizon ~6 months) linked by `parent_recurring_id`.
6. **Schedules appointment notifications** for each created occurrence (`scheduleStoredAppointmentNotifications`).
7. **Syncs side effects** — widget snapshot (`syncWidgetSnapshot`) and product milestones (`first_appointment_added`, `first_useful_action`) on first add.
8. Reloads the Appointments calendar / list so the new visit appears on its date.

### Entry points

| Entry | Behavior |
| --- | --- |
| Appointments header **+** (Calendar tab) | Opens full New Appointment modal |
| Appointments header **Scan** | Opens visual scan import for appointment cards |
| Appointments header **Download** | Opens Apple Calendar import |
| Dashboard / Quick Add | Opens Simple Add via `simpleOpenAddToken` |
| Calendar import token | Can open Apple Calendar import from elsewhere |
| ICS import preview | Review then **Add Appointment** |

---

## What it can do

### Simple Mode stepped flow (**Add Appointment**)

1. **Who is this for?** — You or care recipient (caregiver profiles)
2. **Who is the appointment with?** — Free-text doctor name
3. **When is it?** — Date and time pickers
4. **Review** — Summary card, then **Save Appointment**

Simple add stores doctor name, date, time, and `entryOwner`. Specialty, location, and notes start empty (editable later in detail / edit flows).

### Full form (**New Appointment**)

- **Owner** chips when the profile is a caregiver (You vs cared-for person)
- **Doctor \*** — pick from doctors filtered by owner, or **Add doctor here** inline (name, specialty, hospital, phone, address)
- **Specialty** and **Location** — read-only, filled from the selected doctor’s specialty / hospital
- **Date \*** and **Time** — native date/time pickers (default time `09:00` if unset)
- **Notes** — optional free text
- **Repeat** (create only):
  - Does not repeat
  - Every week
  - Every 2 weeks
  - Every month
  - Custom — interval + day / week / month unit
- Recurring create sets `is_recurring`, `repeat_interval`, `repeat_unit`, and a `repeat_end_date` (~6 months out); storage expands the series

### Editing after create

- Edit one occurrence or **all future occurrences** for a recurring series
- Detail modal actions: edit, reschedule (new date/time, marks prior as rescheduled), cancel, mark done, delete series
- Simple Mode can mark an appointment done (`status: "completed"`)

### Ownership (caregiver)

- `entryOwner`: `self` | `care_recipient`
- Doctor picker is filtered to doctors for the same owner
- Changing owner clears a mismatched selected doctor

### Scan import

From the Appointments scan button:

- Capture / import appointment card text or image
- Parse doctor name, date, time, location, notes
- Save with `source: "scan"`

### Apple Calendar / ICS import

- Pull relevant events from Apple Calendar into Synapse appointments
- ICS preview flow lets users confirm then add
- Imported items can carry sources such as `"calendar"`, `"calendar_import"`, or `"import"`

### After save: what the appointment enables elsewhere

Once added, the appointment can:

- Appear on the **calendar** day view and upcoming lists
- Drive **appointment reminder notifications**
- Update the **widget** appointments snapshot
- Show **travel / leave-by estimates** on iOS when a doctor address or location is available (`appointment-travel`)
- Link to **doctor notes** (prep / visit notes, AI summarize, “talked about”)
- Be **rescheduled**, **cancelled**, or marked **completed**
- Participate in **caregiver** views with an owner badge
- Anchor related lab / imaging records via `appointmentId` elsewhere in the app

---

## Data saved (`Appointment`)

Key fields written by Add Appointment:

| Field | Purpose |
| --- | --- |
| `doctorName` | Display name for the visit |
| `doctor_id` | Linked doctor (full form) |
| `specialty` | Copied from doctor when available |
| `date` | Visit date (`YYYY-MM-DD`) |
| `time` | Visit time (`HH:mm`, default `09:00`) |
| `endTime` | Optional end time (used by some imports) |
| `location` | Often doctor hospital / imported location |
| `notes` | Optional visit notes |
| `phoneNumber` / `arrivalInstructions` | Optional care details (imports / later edit) |
| `source` | `"manual"` \| `"scan"` \| `"calendar"` \| `"import"` \| `"calendar_import"` |
| `is_recurring` / `repeat_interval` / `repeat_unit` / `repeat_end_date` | Series definition on the parent |
| `parent_recurring_id` | Child occurrences in a series |
| `status` | `"completed"` \| `"rescheduled"` \| `"cancelled"` after lifecycle actions |
| `entryOwner` | Self vs care recipient |
| `monthlyReviewOccurred*` | Monthly check-in linkage flags |

---

## Validation rules (save)

**Full form**

- Doctor must be selected
- Date must be non-empty
- Time defaults to `09:00` if left blank
- Custom repeat requires a positive interval

**Simple form**

- Owner selected → doctor name non-empty → date and time set → review → save

**Scan**

- Doctor / appointment name required before save

---

## Related UI on the same screen (not the Add form itself)

These live on Appointments but are separate from Add Appointment:

- Calendar month grid and day lists
- Doctor **Notes** tab (add/edit notes, summarize, talked-about)
- Appointment detail modal (travel text, reschedule, cancel, mark done)
- Recurring series delete / future-delete helpers in storage

---

## File map

```text
synapse-reset/screens/AppointmentsScreen.tsx      # Add / Edit modal, simple + full flows
synapse-reset/screens/VisualScanImportModal.tsx   # Scan → appointment
synapse-reset/screens/AppleCalendarImportModal.tsx
synapse-reset/screens/IcsImportPreviewScreen.tsx
synapse-reset/lib/storage.ts                      # Appointment model + appointmentStorage
synapse-reset/lib/appointment-travel.ts           # Leave-by / drive estimates
synapse-reset/lib/widget-sync.ts                  # Widget snapshot after save
synapse-reset/app/(tabs)/index.tsx                # Quick-open tokens for Add Appointment
```

---

## Summary

**Add Appointment** is how Synapse turns an upcoming visit into a tracked, remindable calendar event. It can create a quick doctor + date + time entry in Simple Mode, or a full doctor-linked visit with notes and recurring series — including caregiver ownership, label/card scan, and Apple Calendar / ICS import.

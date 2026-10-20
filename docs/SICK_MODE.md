# Sick Mode

Detail reference for **Sick Mode** (recovery protocol) in Synapse.

**Primary screen:** `synapse-reset/screens/SickModeScreen.tsx`  
**Activation hub:** `synapse-reset/screens/HealthStatusScreen.tsx`  
**Header control:** `synapse-reset/components/SickModeHeaderButton.tsx`  
**Data model / storage:** `synapse-reset/lib/storage.ts` (`SickModeData`, `sickModeStorage`, `enableRecoveryTracking`)  
**Palette:** `synapse-reset/constants/sick-mode-colors.ts`  
**Check-in notifications:** `synapse-reset/lib/notification-manager.ts` (`syncRecoveryTrackingCheckIn`, `cancelRecoveryCheckIn`)  
**Widget deep link:** `synapse-reset/app/widget/sickmode.tsx`

---

## What it is

Sick Mode is Synapse’s **recovery protocol**: a focused state you turn on when you feel unwell. It is not a separate “add form” like medications or appointments — it is a **mode** that reshapes the app around stress dosing, temperature check-ins, hydration/food/rest tracking, and simplified navigation.

The dedicated experience lives on the **Sick Mode** screen (`screens` → Sick Mode / Health Status → recovery tools). Activation is usually started from **Health Status**, the header **Activate Sick Mode** pill, fever prompts on Symptoms / Ramadan, Siri/app intents, or a widget deep link.

While active, the UI shifts to a sick-mode palette (red-tinted light / dark variants), non-essential nav items are dimmed, and Medications / Dashboard surface stress-dose and recovery tools.

---

## What it does

When Sick Mode turns on, Synapse:

1. Sets `settings.sickMode = true` in user settings.
2. Marks `sickModeStorage` as **active** and records `startedAt`.
3. Enables **recovery tracking** on the health profile (`enableRecoveryTracking`).
4. Schedules a longer-horizon **recovery check-in notification** (~day 3, or soon if already past) via `syncRecoveryTrackingCheckIn`.
5. Starts a **2-hour in-app check-in timer** (`checkInTimer`) for temperature follow-ups on the Sick Mode screen.
6. Optionally notifies a linked caregiver (`sick_mode_activated`).
7. Syncs the **widget** snapshot so home-screen surfaces reflect recovery state.
8. Navigates to (or opens) the Sick Mode screen with an activation banner.

When you finish recovery (**I'm better** / **I'm all better**):

1. Clears `settings.sickMode`.
2. Resets `sickModeStorage` to defaults.
3. Cancels the recovery check-in notification.
4. Syncs the widget and returns to the prior / deactivated flow.

### Activation entry points

| Entry | Behavior |
| --- | --- |
| Health Status → **Preview / Open Sick Mode** | Activates (if off) then opens Sick Mode |
| Header **Activate Sick Mode** pill | Activates then runs `onActivate` / opens screen |
| Dashboard Sick Mode / Health Status card | Routes to Health Status (activate there) or recovery tools when already on |
| Symptoms fever alert (≥ 100°F) | Prompt to activate (stress dosing + protocol) |
| Ramadan fever warning | Confirm dialog to activate |
| App Intent `startSickMode` | Activates with a 2-hour check-in timer |
| Widget / notification `widgetTarget: "sickmode"` | Deep-links into Sick Mode |

---

## What it can do

### Two phases on the Sick Mode screen

1. **Sick Mode Active** — acute recovery focus (red palette, countdown check-ins).
2. **Recovery Mode** — entered when a check-in temperature is **&lt; 99°F**. Check-in timer clears; UI shifts green; copy emphasizes keeping up with hydration, food, and fever meds until you tap **I'm all better**.

### Stress dosing

- Lists medications with `hasStressDose` configured (from Add Medication).
- Shows stress amount, frequency, duration, and special instructions.
- **Dose taken** logs additional medication log entries for the day.
- Dashboard can treat **Hydrocortisone** as **3× dose count** while Sick Mode settings are on (adrenal / stress-dose workflow).

### Temperature tracking

- Log °F readings anytime on the Sick Mode screen (and via Medications protocol / check-in modal).
- History shows recent readings with **Normal / Fever / High Fever** labels (≥ 100 / ≥ 102).
- Latest temp surfaces in the header badge.

### Timed check-ins (active phase only)

- Countdown to next check-in (default interval **2 hours** from start / last check-in).
- Modal asks **How are you?** with a temperature:
  - **&lt; 99°F** → switch to Recovery Mode (Sick Mode not fully off).
  - **99–101.9°F** → schedule next 2-hour check-in.
  - **≥ 102°F** → schedule next check-in and show **see a doctor ASAP** alert.

### Recovery checklist / progress

Tracks completed actions toward a simple progress bar (4–5 items):

- Hydration (≥ 250 mL logged; goal display **2000 mL**, +250 mL taps)
- Food (light meal toggle on Sick Mode screen; fuller food checklist on Medications protocol)
- Stress dose logged (if any stress-dose meds exist)
- Rest (lying / resting toggle)
- At least one temperature reading

### Comfort suggestions

- For the first **24 hours** after activation, shows saved **Comfort** items (“Things that might help”) from comfort storage.

### Cross-app behavior while on

| Area | Effect |
| --- | --- |
| Navigation | Dims non-essential tabs; keeps dashboard, sick mode, meds, symptoms, health, emergency, account/settings prominent |
| Theme / chrome | Sick Mode palette; red accents on active nav |
| Medications | **Sick Mode Protocol** section: hydration, food checklist, temperature, rest, symptom chips; stress-dose emphasis |
| Dashboard | Health Status card shows Sick Mode badge; meds priority may label **Stress Dosing**; Hydrocortisone dose inflation |
| Reports | Sick Mode summary block |
| Caregiver | Can report activation events; status helpers read sick mode state |
| Widgets | Sick Mode route + snapshot updates |

### Deactivation

- Sick Mode screen: **I'm better** (active) or **I'm all better** (recovery phase).
- Dashboard Health Status flow can also confirm ending recovery / turning Sick Mode off and resetting storage.

---

## Data saved (`SickModeData`)

| Field | Purpose |
| --- | --- |
| `active` | Whether the protocol session is active |
| `startedAt` | ISO timestamp when activated |
| `recoveryMode` | True after temp check-in &lt; 99°F |
| `checkInTimer` | ISO time of next in-app temperature check-in |
| `lastCheckIn` | ISO time of last completed check-in |
| `hydrationMl` | Cumulative hydration for the session |
| `foodChecklist` | `lightMeal`, `saltySnack`, `liquidCalories` |
| `restChecklist` | `lying`, `napping`, `screenBreak` |
| `symptoms` | Symptom chips logged during protocol |
| `temperatures` | `{ time, value }` °F readings |
| `prnDoses` | Optional PRN dose log entries during illness |

Related flags outside this object:

- `UserSettings.sickMode` — global on/off switch used across screens
- `HealthProfileInfo.recoveryTrackingEnabled` / `recoveryTrackingStartedAt` / `recoveryFocus` — longer recovery tracking + notification scheduling

---

## Thresholds and constants

| Constant | Value | Role |
| --- | --- | --- |
| Hydration goal | 2000 mL | Progress display |
| Check-in interval | 2 hours | In-app temperature prompts |
| Comfort window | 24 hours | Show comfort suggestions |
| Fever prompt (Symptoms) | ≥ 100°F | Offer activation |
| Recovery transition | &lt; 99°F | Enter Recovery Mode |
| High fever alert | ≥ 102°F | Urge medical care |
| Hydrocortisone multiplier | ×3 | Extra doses while settings.sickMode |

---

## Related UI (not the Sick Mode screen alone)

- **Health Status** — primary place to preview/open Sick Mode
- **Medications** — stress-dose fields on Add Medication; protocol cards while sick
- **Symptoms / Ramadan** — fever-driven activation prompts
- **Comfort** screen / storage — suggestions shown early in illness
- **Caregiver linking** — activation event sharing
- **App intents** — voice / system start of Sick Mode

---

## File map

```text
synapse-reset/screens/SickModeScreen.tsx
synapse-reset/screens/HealthStatusScreen.tsx
synapse-reset/components/SickModeHeaderButton.tsx
synapse-reset/constants/sick-mode-colors.ts
synapse-reset/lib/storage.ts                 # SickModeData, sickModeStorage, enableRecoveryTracking
synapse-reset/lib/notification-manager.ts    # Recovery check-in schedule/cancel
synapse-reset/lib/caregiver-linking.ts       # sick_mode_activated
synapse-reset/lib/app-intents.ts             # startSickMode
synapse-reset/lib/widget-sync.ts
synapse-reset/app/widget/sickmode.tsx
synapse-reset/components/SidebarLayout.tsx   # ESSENTIAL_SICK_KEYS nav dimming
synapse-reset/screens/MedicationsScreen.tsx  # Protocol + stress dose while sick
synapse-reset/screens/DashboardScreen.tsx    # Health Status / stress dosing cards
synapse-reset/screens/SymptomsScreen.tsx     # Fever → activate
synapse-reset/app/(tabs)/index.tsx           # Routing to sickmode screen
```

---

## Summary

**Sick Mode** is Synapse’s illness recovery mode: activate it when you are unwell, follow stress-dosing and check-in guidance, track temperature / hydration / food / rest, optionally step down into Recovery Mode when fever eases, then turn it off when you are better — with widgets, caregivers, and essential navigation kept in the loop the whole time.

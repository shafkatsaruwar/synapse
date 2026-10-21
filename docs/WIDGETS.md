# Widgets

Detail reference for **home-screen widgets** in Synapse (iOS).

**Native extension:** `synapse-reset/ios/SynapseWidgets/`  
**Bundle entry:** `SynapseWidgetsBundle.swift` (registers all widgets)  
**UI + kinds:** `SynapseWidgets.swift`  
**JS snapshot builder:** `synapse-reset/lib/widget-sync.ts` (`syncWidgetSnapshot`)  
**Native bridge:** `synapse-reset/ios/Synapse/SynapseWidgetBridge.swift`  
**Deep-link routes:** `synapse-reset/app/widget/*.tsx`  
**In-app routing:** `synapse-reset/app/(tabs)/index.tsx` (`navigateToWidgetTarget`)  
**Appearance setting:** `HealthProfileInfo.widgetAppearance` (`system` \| `calm` \| `light` \| `dark`)

---

## What it is

Synapse ships an **iOS WidgetKit extension** (`SynapseWidgets`) with **16 home-screen widgets**. They are read-mostly glance surfaces powered by a shared JSON **snapshot** written from the React Native app into an App Group (`group.com.mohammedsaruwar.synapse`), then reloaded via `WidgetCenter.reloadAllTimelines()`.

Widgets are **not** a separate in-app “Add Widget” screen — users add them from the iOS home-screen widget gallery under Synapse. Tapping a widget opens the app through `myapp:///?widgetTarget=…` (and optional `mode` / `medId` query params).

There is **no Android App Widget** implementation in this repo today; `syncWidgetSnapshot()` early-returns unless `Platform.OS === "ios"`.

---

## What it does

### Data pipeline

1. App events (meds taken, appointments saved, sick mode, hydration, logs, etc.) call `syncWidgetSnapshot()`.
2. The JS layer loads today’s medications, appointments, logs, symptoms, hydration, sick/mental-health mode, labs, caregiver profile, and related history.
3. It builds one `WidgetSnapshot` object (appearance + per-widget slices).
4. `SynapseWidgetBridge.saveSnapshot` writes JSON into App Group UserDefaults (`synapse_widget_snapshot`) and reloads all widget timelines.
5. Each widget’s `SynapseProvider` reads that snapshot and renders its view; timelines refresh sooner when a med is due, PRN was logged, or sick/recovery/mental-health modes are active (otherwise ~30 minutes).

### Appearance

Widget chrome uses the profile’s **widget appearance** preference (`system`, `calm`, `light`, `dark`) with matching light / calm / dark palettes in Swift. Soft Evergreen app themes do not currently drive widget chrome.

### Deep links

| Widget target | Opens in app |
| --- | --- |
| `medications` | Medications |
| `appointments` | Appointments (optional focused appointment) |
| `dashboard` | Dashboard |
| `daily-log` / `logtoday` | Daily log / Log Today |
| `symptoms` | Symptoms |
| `hydration` (+ `mode=quick-sip`) | Eating / hydration; can log a quick sip |
| `prnlog` (+ `medId`) | Logs that PRN dose from the widget tap |
| `sickmode` | Activates Sick Mode if needed, then opens Sick Mode |
| `recovery` | Opens Sick Mode **without** forcing activation |
| `mentalhealth` | Mental Health Mode |
| `labwork` | Lab Work |
| `reports` | Reports |
| `caregiverdashboard` (+ `mode=log-med` / `add-note`) | Caregiver dashboard with optional launch action |

Expo Router helpers under `app/widget/` redirect into `/` with the matching `widgetTarget` param.

---

## What each widget can do

### Small (`.systemSmall`)

| Gallery name | Kind | Shows | Tap opens |
| --- | --- | --- | --- |
| **Next Medication** | `SynapseMedicationWidget` | Next due dose time, status (Next/Done), secondary line | Medications |
| **Hydration** | `SynapseHydrationWidget` | % of soft daily target, sips logged, progress bar | Hydration with **quick-sip** |
| **As Needed** | `SynapsePrnMedicationWidget` | Hours since last PRN / rescue med, watch window | PRN log for that med id |
| **Pain** | `SynapsePainWidget` | Severity hero, symptom name, watch/up/calm status | Symptoms |
| **Sleep** | `SynapseSleepWidget` | Sleep score / hero text, pacing note | Daily Log |
| **Sick Mode** | `SynapseSickModeWidget` | Active / Easing / Off, hero action, stress-dose cue | Sick Mode (may activate) |

### Medium (`.systemMedium`)

| Gallery name | Kind | Shows | Tap opens |
| --- | --- | --- | --- |
| **Recovery Today** | `SynapseRecoveryWidget` | Recovery story headline, status, soft progress | Sick Mode (read-only open) |
| **Flare Forecast** | `SynapseFlareForecastWidget` | Cautious watch/calm story from today’s factors + trend strip | Reports |
| **Appointment Prep** | `SynapseAppointmentWidget` | Next visit prep rows (when/travel/packet hints) | Appointments |
| **Caregiver** | `SynapseCaregiverWidget` | Managed-person status, attention items | Caregiver dashboard |
| **Mental Health** | `SynapseMentalHealthWidget` | Energy/stress headline + gentle trend dots | Mental Health |
| **Labs** | `SynapseLabsWidget` | Lab review headline, progress | Lab Work |
| **Synapse Overview** | `SynapseOverviewWidget` | Next med + next visit side by side | Dashboard |

### Large (`.systemLarge`)

| Gallery name | Kind | Shows | Tap opens |
| --- | --- | --- | --- |
| **Daily Log** | `SynapseWellnessWidget` | Today’s check-in headline, metric grid, action rows | Daily Log |
| **Medication Day** | `SynapseMedicationDayWidget` | Taken/expected grid, upcoming dose action rows | Medications |
| **14-Day Report** | `SynapseReportWidget` | Two-week pattern grid, adherence, report actions | Reports |

---

## Snapshot slices (`WidgetSnapshot`)

Built in `widget-sync.ts` and consumed by Swift:

| Slice | Powers |
| --- | --- |
| `medication` | Next Medication + Overview med column |
| `medicationDay` | Medication Day |
| `prnMedication` | As Needed |
| `appointment` | Appointment Prep + Overview visit column |
| `hydration` | Hydration (+ wellness/recovery inputs) |
| `sleep` | Sleep (+ flare forecast) |
| `pain` | Pain (+ wellness / flare) |
| `wellness` | Daily Log |
| `sickMode` | Sick Mode widget |
| `recovery` | Recovery Today |
| `flareForecast` | Flare Forecast |
| `mentalHealth` | Mental Health |
| `caregiver` | Caregiver |
| `labs` | Labs |
| `report14Day` | 14-Day Report |
| `appearance` / `updatedAt` | Theme + freshness |

---

## What widgets can do for the user

- Glance **next dose** and **day progress** without opening the app
- One-tap **quick sip** hydration logging
- One-tap **PRN / rescue med** logging
- Jump into **Sick Mode**, **appointments prep**, **symptoms**, **labs**, **reports**, **mental health**, or **caregiver** workflows
- See **recovery / flare / 14-day** narrative summaries on the home screen
- Refresh automatically when the app writes a new snapshot after normal use

Widgets do **not** (today):

- Run on Android
- Edit full medication/appointment forms from the home screen (except PRN log and quick-sip side effects)
- Use Soft Evergreen app theme tokens for chrome

---

## When snapshots refresh

`syncWidgetSnapshot()` is called from many product surfaces after meaningful changes, including:

- Medications (add/edit/delete, dose toggle, PRN log)
- Appointments (add/edit/status)
- Sick Mode / symptoms / mental health / daily log / hydration-related flows
- Settings (including widget appearance changes)
- Visual scan imports and guided add flows

Native side then reloads **all** widget timelines.

---

## File map

```text
synapse-reset/ios/SynapseWidgets/
  SynapseWidgetsBundle.swift     # Registers 16 widgets
  SynapseWidgets.swift           # Snapshot decode, views, kind configs
  SynapseWidgets.entitlements    # App Group
synapse-reset/ios/Synapse/
  SynapseWidgetBridge.swift      # saveSnapshot → App Group + reload
  SynapseWidgetBridge.m          # Obj-C export
synapse-reset/lib/widget-sync.ts # Builds WidgetSnapshot (iOS only)
synapse-reset/app/widget/        # Expo redirects for each widgetTarget
synapse-reset/app/(tabs)/index.tsx
```

---

## Summary

Synapse’s widgets are an **iOS WidgetKit suite** fed by a single shared snapshot from the app. You get small glance tiles (next med, hydration, PRN, pain, sleep, sick mode), medium story cards (recovery, flare, appointments, caregiver, mental health, labs, overview), and large day/report boards (daily log, medication day, 14-day report) — each tappable into the right Synapse screen, with a few quick actions (sip, PRN log, sick-mode open) built in.

# Synapse — Features & Screen Map

A reference that maps every **feature** in the Synapse app to the **screens** that implement it, plus the supporting logic modules, navigation keys, and iOS home-screen widgets.

- App code lives in `synapse-reset/`.
- Screens live in `synapse-reset/screens/*.tsx`.
- Screen routing is centralized in `synapse-reset/app/(tabs)/index.tsx` via a `switch (activeScreen)` on a **nav key** string. The "Nav key" column below is that string (what `onNavigate("…")` receives).
- Navigation chrome (sidebar / drawer / tab bar) is in `synapse-reset/components/SidebarLayout.tsx`.
- Feature logic/storage lives in `synapse-reset/lib/*.ts`; per-domain persistence is in `synapse-reset/lib/storage.ts` (the `*Storage` objects).

> Accuracy note: this reflects the `main` branch. A few screens exist in the repo but are not wired into navigation (legacy/unused) — they're called out in the [Legacy / unused](#legacy--unused-screens) section. Two features are gated behind compile-time flags in `constants/feature-flags.ts` (`documentScannerEnabled`, `medicationEnforcementEnabled`), both `false` by default.
>
> **Synapse Plus** (v1.17+): optional App Store IAP. Free forever: medications, appointments, Sick Mode, basic Emergency Card, You & Settings essentials. Plus: How I’m Feeling, Health Records, Wellbeing, Check-In, Care & Support, advanced Emergency Card export/save. See `docs/SYNAPSE_PLUS.md`.

---

## 1. App-wide modes, roles & navigation

Synapse adapts its surface area based on **mode** and **role**.

| Concept | Values | Where | Notes |
|---|---|---|---|
| App Mode | `full` \| `simple` | `contexts/AppModeContext.tsx`, `lib/storage.ts` (`AppMode`) | Simple mode trims navigation to a focused set (Home, Meds, Visits, Symptoms, Account). |
| User Role | `self` \| `caregiver` \| `backup` | `contexts/RoleContext.tsx`, `lib/storage.ts` (`UserRole`) | Drives Caregiver Dashboard / Managed Person surfaces. |
| Theme | system / light / dark + accents | `contexts/ThemeContext.tsx`, `constants/colors.ts` | |
| Display / text size | accessibility text scaling | `contexts/DisplaySettingsContext.tsx`, `lib/accessibility.ts` | |
| Sick Mode | on/off overlay | `screens/SickModeScreen.tsx`, `lib/storage.ts` (`sickModeStorage`), `constants/sick-mode-colors.ts` | A reduced-stress recovery surface. |
| Ramadan Mode | on/off | `screens/RamadanScreen.tsx`, `lib/hijri.ts`, `constants/ramadan-timetable.ts` | Fasting-aware logging & tips. |
| Onboarding | first-run flow | `screens/OnboardingScreen.tsx`, `lib/walkthrough-storage.ts`, `components/AppWalkthrough.tsx` | |
| App walkthrough / tour | guided tour | `components/AppWalkthrough.tsx`, `contexts/WalkthroughContext.tsx` | Re-launchable from Account. |

Navigation groups (from `SidebarLayout.tsx`): **Main**, **Caregiver**, **Emergency**, **Primary**, **Diagnostics**, **Health & Insights**, **System**.

---

## 2. Feature catalog

### 2.1 Dashboard & daily tracking

| Feature | What it does | Screen(s) (file · nav key) | Supporting modules |
|---|---|---|---|
| Dashboard / Home | At-a-glance home: today's meds, appointments, quick actions | `DashboardScreen.tsx` · `dashboard` / `home` | `lib/today-at-a-glance.ts`, `lib/nav-badge-counts.ts` |
| Daily Log | Daily check-in: energy, mood, sleep, fatigue, symptoms-of-the-day, fasting flag | `DailyLogScreen.tsx` · `log` / `logtoday` / `dailylog` | `healthLogStorage` |
| Vitals | Record & chart vitals (HR, BP, weight, temp, O₂, glucose, sleep, steps) | `HealthDataScreen.tsx` · `healthdata` | `vitalStorage`, `lib/apple-health.ts`, `lib/health-integration-service.ts` |
| Symptoms | Log & track symptoms over time (active) | `ImprovedSymptomsScreen.tsx` · `symptoms` | `symptomStorage` |
| Monthly check-in | Periodic broader health review | `MonthlyCheckInScreen.tsx` · `monthlycheckin` | `monthlyCheckInStorage` |
| Timeline | Unified chronological health timeline | `TimelineScreen.tsx` · `timeline` | `lib/health-timeline.ts` |

### 2.2 Medications

| Feature | What it does | Screen(s) (file · nav key) | Supporting modules |
|---|---|---|---|
| Medications | Manage meds, doses, schedules; mark taken; PRN logging | `MedicationsScreen.tsx` · `medications` (quick-add `medication`) | `medicationStorage`, `medicationLogStorage`, `lib/medication-schedule.ts`, `lib/med-list-storage.ts` |
| Medication reminders | Local notifications for doses | (scheduling) | `lib/notification-manager.ts` |
| Medication Enforcement Mode *(private, flag-gated)* | Accountability escalations when a dose is missed | `components/MedicationEnforcementCard.tsx` (mounted in `MedicationsScreen.tsx`) | `lib/med-enforcement.ts`, `lib/med-enforcement-core.ts`, `constants/med-enforcement-copy.ts`, gated by `featureFlags.medicationEnforcementEnabled` **and** `UserSettings.medicationEnforcementEnabled` |
| Med comparison | Compare current meds vs. a scanned document's meds | within `DocumentsScreen.tsx` | `medComparisonStorage`, `lib/api.ts` (`compareMedications`) |

### 2.3 Appointments, doctors & calendar

| Feature | What it does | Screen(s) (file · nav key) | Supporting modules |
|---|---|---|---|
| Appointments | Create/track appointments, recurring visits, travel time | `AppointmentsScreen.tsx` · `appointments` (quick-add `appointment`) | `appointmentStorage`, `lib/appointments-api.ts`, `lib/appointment-travel.ts` |
| Apple Calendar import | Import device calendar events as appointments | `AppleCalendarImportModal.tsx` | `lib/apple-calendar-import.ts` |
| ICS import | Import `.ics` calendar files with preview | `IcsImportPreviewScreen.tsx`; route `app/import/appointment.tsx` | `lib/ics-import.ts`, `lib/ics-parser.ts`, `lib/ics-import-event.ts` |
| Doctors | Manage care team / doctors | `DoctorsScreen.tsx` · `doctors` | `doctorsStorage`, `primaryDoctorStorage`, `emergencyDoctorStorage`, `doctorNoteStorage`, `lib/doctors-api.ts` |
| Pharmacies | Manage pharmacies | `PharmaciesScreen.tsx` · `pharmacies` | `pharmacyStorage` |

### 2.4 Diagnostics & records

| Feature | What it does | Screen(s) (file · nav key) | Supporting modules |
|---|---|---|---|
| Lab Work | Record lab results, values & reference ranges | `LabWorkScreen.tsx` · `labwork` | `labWorkStorage` |
| Imaging | Track imaging studies | `ImagingScreen.tsx` · `imaging` | `imagingStorage` |
| Documents (scan & extract) *(flag-gated)* | Scan/upload medical docs; AI extracts structured data | `DocumentsScreen.tsx` · `documents`; `VisualScanImportModal.tsx` | `documentStorage`, `lib/visual-scan.ts`, `lib/api.ts` (`analyzeDocument`), gated by `featureFlags.documentScannerEnabled` |
| Health Insights (AI) *(flag-gated)* | AI analysis of patterns, correlations, labs to track | `InsightsScreen.tsx` · `insights` | `insightStorage`, `lib/api.ts` (`getHealthInsights`), `lib/recovery-insights.ts` |

### 2.5 Wellbeing & lifestyle

| Feature | What it does | Screen(s) (file · nav key) | Supporting modules |
|---|---|---|---|
| Eating & hydration | Food log + hydration tracking | `EatingScreen.tsx` · `eating` | `eatingStorage`, `hydrationStorage`, `lib/hydration-format.ts` |
| Mental health day | Mental-health mode with check-ins / supports | `MentalHealthModeScreen.tsx` · `mentalhealth` | `mentalHealthModeStorage` |
| Mood lifters (Comfort) | Comfort/mood-boosting content | `ComfortScreen.tsx` · `comfort` | `comfortStorage` |
| Goals | Set & track health goals | `GoalsScreen.tsx` · `goals` | `goalStorage` |
| Cycle tracking | Menstrual cycle tracking | `CycleTrackingScreen.tsx` · `cycletracking` | `cycleTrackingStorage`, `lib/cycle-detection.ts` |
| Sick Mode | Low-effort recovery surface | `SickModeScreen.tsx` · `sickmode` | `sickModeStorage`, `components/SickModeHeaderButton.tsx` |
| Ramadan Mode | Fasting-aware logging & tips | `RamadanScreen.tsx` · `ramadan`; `RamadanDailyLogScreen.tsx` · `ramadandailylog` | `fastingLogStorage`, `ramadanDailyLogStorage`, `lib/hijri.ts`, `constants/ramadan-timetable.ts` |

### 2.6 Emergency

| Feature | What it does | Screen(s) (file · nav key) | Supporting modules |
|---|---|---|---|
| Emergency Protocol | Step-by-step emergency instructions | `EmergencyProtocolScreen.tsx` · `emergency` | — |
| Emergency Card | Shareable critical info card (conditions, allergies, meds, contacts) | `EmergencyCardScreen.tsx` · `emergencycard` | `lib/emergency-card-storage.ts`, `emergencyDoctorStorage` |

### 2.7 Health profile

| Feature | What it does | Screen(s) (file · nav key) | Supporting modules |
|---|---|---|---|
| Health profile | Core profile (name, role, conditions, critical meds, widget appearance) | `HealthProfileScreen.tsx` · `healthprofile` | `healthProfileStorage` |
| Conditions | Manage chronic conditions | `HealthProfileConditionsScreen.tsx` · `healthprofileconditions` | `conditionStorage`, `constants/conditions.json` |
| Allergies | Manage allergies | `AllergyScreen.tsx` · `allergy` | `allergyStorage` |
| Edit profile | Edit profile details + restore entry point | `EditProfileScreen.tsx` · `editprofile` | `healthProfileStorage`, `lib/backup.ts` |

### 2.8 Caregiver & multi-person

| Feature | What it does | Screen(s) (file · nav key) | Supporting modules |
|---|---|---|---|
| Caregiver Dashboard | Monitor a linked patient's signals/events | `CaregiverDashboardScreen.tsx` · `caregiverdashboard`; route `app/caregiverdashboard.tsx` | `lib/caregiver-linking.ts`, `lib/caregiver-status.ts`, `caregiverProfileStorage`, `roleStorage` |
| Managed Person | Manage the person a caregiver is linked to | `ManagedPersonScreen.tsx` · `managedperson` | `caregiverProfileStorage` |
| Caregiver linking | Patient-approved link codes + push events | (backend) | `lib/caregiver-linking.ts`, Supabase Edge Functions `supabase/functions/send-caregiver-event`, `send-caregiver-reminder` |

### 2.9 Reports, feedback & about

| Feature | What it does | Screen(s) (file · nav key) | Supporting modules |
|---|---|---|---|
| Reports | Generate/share health reports & summaries | `ReportsScreen.tsx` · `reports` | multiple `*Storage`, `lib/health-timeline.ts` |
| Feedback | In-app feedback flow | `FeedbackScreen.tsx` · `feedback` | `feedbackStorage`, `lib/feedback-service.ts`, `lib/review-prompt.ts` |
| Meet the founder | About/founder screen | `MeetFounderScreen.tsx` · `meetfounder` | — |

### 2.10 Account, privacy, security & sync

| Feature | What it does | Screen(s) (file · nav key) | Supporting modules |
|---|---|---|---|
| Account / Settings | Central settings hub: profile, modes, notifications, backups, assistant access, reset | `SettingsScreen.tsx` · `settings` | most contexts + `*Storage` |
| Authentication | Email sign up / sign in / password reset (Supabase) | `AuthScreen.tsx` · `auth` | `contexts/AuthContext.tsx`, `lib/supabase.ts`, `lib/auth-network-error.ts` |
| Privacy | Privacy controls, export, data retention | `PrivacyScreen.tsx` · `privacy` | `lib/data-retention.ts`, `lib/encryption.ts` |
| Export / Restore from file | Export all data to JSON; restore (import) from a file | `PrivacyScreen.tsx` / `SettingsScreen.tsx` | `lib/storage.ts` (`exportAllData`), `lib/backup-import.ts` |
| Biometric lock | Face ID / passcode gate | `components/BiometricGate.tsx` | `lib/biometric-storage.ts` |
| iCloud / CloudKit backup | Private per-user iCloud backup & restore | `SettingsScreen.tsx` | `lib/cloudkit-backup.ts`, `lib/cloudkit-backup-scheduler.ts`, `lib/cloudkit-error-copy.ts`, native `ios/Synapse/SynapseCloudKitBridge.swift` |
| Signed-in cloud copy (Assistant access) | Optional Supabase copy so a personal assistant can read your data over MCP | `SettingsScreen.tsx` | `lib/backup.ts`, `lib/assistant-cloud-sync.ts`, `lib/supabase.ts` |
| Health MCP connector | Owner-only, read-only health data over MCP | — (`mcp/`) | `mcp/`, `server/` |
| Apple Health | Import vitals from Apple Health (read-only) | `SettingsScreen.tsx`, `HealthDataScreen.tsx` | `lib/apple-health.ts`, `lib/health-integration-service.ts` |
| Audit logging | Local audit trail of sensitive actions | (app-wide) | `lib/audit-logger.ts` |
| Developer mode | Hidden developer diagnostics | `SettingsScreen.tsx` | `lib/developer-mode.ts` |

---

## 3. iOS home-screen widgets

Widget web entry points under `synapse-reset/app/widget/` (bridged to native WidgetKit; synced via `lib/widget-sync.ts`, `lib/app-intents.ts`, `lib/synapse-hq-storage.ts`).

| Widget | Route |
|---|---|
| Appointments | `app/widget/appointments.tsx` |
| Caregiver dashboard | `app/widget/caregiverdashboard.tsx` |
| Daily log | `app/widget/daily-log.tsx` |
| Hydration | `app/widget/hydration.tsx` |
| Lab work | `app/widget/labwork.tsx` |
| Log today | `app/widget/logtoday.tsx` |
| Medications | `app/widget/medications.tsx` |
| Mental health | `app/widget/mentalhealth.tsx` |
| PRN log | `app/widget/prn-log.tsx`, `app/widget/prnlog.tsx` (+ `app/prnlog.tsx`) |
| Recovery | `app/widget/recovery.tsx` |
| Reports | `app/widget/reports.tsx` |
| Sick mode | `app/widget/sickmode.tsx` |
| Symptoms | `app/widget/symptoms.tsx` |

---

## 4. Master screen index

Every file in `synapse-reset/screens/` → its nav key and purpose.

| Screen file | Nav key | Feature / purpose |
|---|---|---|
| `DashboardScreen.tsx` | `dashboard` / `home` | Home dashboard |
| `DailyLogScreen.tsx` | `log` / `logtoday` / `dailylog` | Daily check-in |
| `HealthDataScreen.tsx` | `healthdata` | Vitals |
| `ImprovedSymptomsScreen.tsx` | `symptoms` | Symptoms (active) |
| `MedicationsScreen.tsx` | `medications` | Medications |
| `AppointmentsScreen.tsx` | `appointments` | Appointments |
| `DoctorsScreen.tsx` | `doctors` | Doctors / care team |
| `PharmaciesScreen.tsx` | `pharmacies` | Pharmacies |
| `LabWorkScreen.tsx` | `labwork` | Lab work |
| `ImagingScreen.tsx` | `imaging` | Imaging |
| `DocumentsScreen.tsx` | `documents` | Document scan & extract *(flag)* |
| `InsightsScreen.tsx` | `insights` | AI health insights *(flag)* |
| `TimelineScreen.tsx` | `timeline` | Health timeline |
| `MonthlyCheckInScreen.tsx` | `monthlycheckin` | Monthly check-in |
| `EatingScreen.tsx` | `eating` | Eating & hydration |
| `MentalHealthModeScreen.tsx` | `mentalhealth` | Mental health day |
| `ComfortScreen.tsx` | `comfort` | Mood lifters |
| `GoalsScreen.tsx` | `goals` | Goals |
| `CycleTrackingScreen.tsx` | `cycletracking` | Cycle tracking |
| `SickModeScreen.tsx` | `sickmode` | Sick Mode |
| `RamadanScreen.tsx` | `ramadan` | Ramadan Mode |
| `RamadanDailyLogScreen.tsx` | `ramadandailylog` | Ramadan daily log |
| `EmergencyProtocolScreen.tsx` | `emergency` | Emergency protocol |
| `EmergencyCardScreen.tsx` | `emergencycard` | Emergency card |
| `HealthProfileScreen.tsx` | `healthprofile` | Health profile |
| `HealthProfileConditionsScreen.tsx` | `healthprofileconditions` | Conditions |
| `AllergyScreen.tsx` | `allergy` | Allergies |
| `EditProfileScreen.tsx` | `editprofile` | Edit profile |
| `CaregiverDashboardScreen.tsx` | `caregiverdashboard` | Caregiver dashboard |
| `ManagedPersonScreen.tsx` | `managedperson` | Managed person |
| `ReportsScreen.tsx` | `reports` | Reports |
| `FeedbackScreen.tsx` | `feedback` | Feedback |
| `MeetFounderScreen.tsx` | `meetfounder` | Meet the founder |
| `SettingsScreen.tsx` | `settings` | Account / Settings |
| `AuthScreen.tsx` | `auth` | Sign in / sign up |
| `PrivacyScreen.tsx` | `privacy` | Privacy |
| `OnboardingScreen.tsx` | (first-run) | Onboarding |
| `AppleCalendarImportModal.tsx` | (modal) | Apple Calendar import |
| `VisualScanImportModal.tsx` | (modal) | Camera/photo scan import |
| `IcsImportPreviewScreen.tsx` | (import flow) | `.ics` import preview |

### Legacy / unused screens
Present in the repo but **not wired into navigation** (0 active references):

| Screen file | Status |
|---|---|
| `ImprovedDashboardScreen.tsx` | Unused (superseded by `DashboardScreen.tsx`) |
| `SymptomsScreen.tsx` | Legacy (superseded by `ImprovedSymptomsScreen.tsx`) |
| `AuthStub.tsx` | Stub / unused |
| `DashboardStub.tsx` | Stub / unused |

---

## 5. Cross-cutting support modules

| Area | Modules |
|---|---|
| Storage & validation | `lib/storage.ts`, `lib/validated-storage.ts`, `lib/validation.ts`, `lib/secure-storage.ts`, `lib/encryption.ts` |
| Notifications | `lib/notification-manager.ts` |
| Dates / locale | `lib/date-utils.ts`, `lib/hijri.ts` |
| Device / platform | `lib/device.ts`, `lib/accessibility.ts`, `lib/modal-colors.ts` |
| Backup & sync | `lib/backup.ts`, `lib/cloudkit-backup.ts`, `lib/cloudkit-backup-scheduler.ts`, `lib/widget-sync.ts`, `lib/data-retention.ts` |
| Integrations | `lib/apple-health.ts`, `lib/apple-calendar-import.ts`, `lib/health-integration-service.ts`, `lib/foundation-models.ts`, `lib/module-integration.ts` |
| Backend API | `lib/api.ts`, `lib/supabase.ts`, `lib/appointments-api.ts`, `lib/doctors-api.ts`, `server/`, `api/` |
| UI building blocks | `components/ui/`, `components/GlassView.tsx`, `components/AppBackground.tsx`, `components/SidebarLayout.tsx`, `components/TabletSidebar.tsx`, `components/ErrorBoundary.tsx` |

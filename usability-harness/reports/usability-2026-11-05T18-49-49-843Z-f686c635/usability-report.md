# Synapse Usability Report

**Session:** `usability-2026-11-05T18-49-49-843Z-f686c635`
**When:** Thursday, Nov 5, 2026, 1:50 PM–3:33 PM (America/New_York)
**Vision provider:** bridge (screenshot decisions). `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` were unset, so no vision API was used.
**Device:** disposable simulator `SynapseUsabilityDisposable` (iPhone 16, iOS 26.5). Bundle `com.mohammedsaruwar.synapse`, app version 1.17.0 shown in the menu.
**Persona:** first-time, low-confidence. Taps were chosen from screenshots only. Fictional data only. No purchase, message, notification allow, or real account.

This simulator session does not replace testing with real people. Product findings below are what was on screen. Speculation and harness failures are in their own sections. No UX change was made.

## Method

Maestro 2.12.1 drove the simulator. The agent wrote one action per screenshot. Safety mode stayed on: purchases, caregiver messages, notification Allow, and real sign-in were not used.

Fictional inputs that were actually entered:

- Preferred name: Alex
- Medication: Lisinopril (test), 10 mg, once daily, reminder left on at 8:00 AM
- Appointment: Dr. Morgan Lee, Fri Nov 6, 2026, 2:37 PM, Riverside Clinic - Test Wing
- Sick-mode check-in: Better, with no temperature and no note

## Task results

| Task | Harness status | What the product actually did |
|---|---|---|
| Complete onboarding | completed | Welcome, skip sign-in, name Alex, explore on my own, home greeting visible |
| Add a sample medication and reminder | blocked | Harness timed out on the dose keypad. The medication was saved anyway and was visible on later screens |
| Add a doctor's appointment | completed | Visit visible on the calendar after save |
| Find the Emergency Card | completed | Emergency screen opened. No screen titled Emergency Card |
| Locate and use Sick Mode | completed | Turned on, then moved to Recovering. No End control was found on that screen |
| Find health records and identify Plus restrictions | completed | All five record types show Plus. Vitals opens a 7-day trial screen. Not now was used |
| Recover from an incorrect tap | completed | Opened Wellbeing, then the house tab returned to the home hub |
| Locate subscription pricing and restore purchases | completed | Prices and Restore Purchases were visible. Start Free Trial was not tapped |

| Task | Elapsed | Taps | Text entries | Assistance |
|---|---:|---:|---:|---|
| Complete onboarding | 12m 35s | 7 | 1 | no |
| Add a sample medication and reminder | 13m 29s | 7 | 2 | yes (harness timeout) |
| Add a doctor's appointment | 32m 43s | 26 | 2 | no |
| Find the Emergency Card | 10m 44s | 5 | 0 | no |
| Locate and use Sick Mode | 16m 50s | 12 | 0 | no |
| Find health records and identify Plus restrictions | 5m 35s | 4 | 0 | no |
| Recover from an incorrect tap | 4m 23s | 3 | 0 | no |
| Locate subscription pricing and restore purchases | 7m 23s | 5 | 0 | no |

## Findings

Ranked by how much they would throw off a first-time user. Suggested changes are notes for a human reviewer, not implemented fixes.

### Major

**1. A morning dose added in the afternoon is immediately “Missed,” counted to the minute.**

- **Kind:** Observed
- **Where:** Home, after Lisinopril (test) was saved
- **What was on screen:** At 3:00 PM the home card read “Lisinopril (test) / 10 mg · Morning · Missed 420 mins ago.” 420 minutes is 3:00 PM minus 8:00 AM. An earlier home view in the same session said “Missed 383 mins ago” at about 2:23 PM, the same arithmetic. The medications list itself showed the row as “10 mg · 8:00 AM” with “Mark As Taken,” “0 of 1 taken today,” and “Needs attention 1.”
- **Why it matters:** The first medicine a person adds, at the only time they are in the app, is presented as already missed.
- **Evidence:** `screenshots/use_sick_mode-step-01.png`

**2. Sick Mode can be turned on in one tap, and the Sick Mode screen never offered a way to turn it off.**

- **Kind:** Observed
- **Where:** Home “Activate Sick Mode,” then the Sick Mode screen
- **What was on screen:** The home button turned the mode on immediately. The screen said “You’re in Sick Mode.” Check-in choices were Better, About the same, and Worse. Choosing Better did not end the mode. A dialog said “Sick Mode is now in recovering. Check-ins pause. End Sick Mode when you feel ready.” After OK, the badge said Recovering, the body text still said “End Sick Mode when you feel ready,” and the only button said “I’m still improving.” Tapping that sentence and that button did not change the screen. The menu items were the same as before (Today, Medications, Appointments, How I’m Feeling, Health Records, Wellbeing, Care & Support, Emergency, You & Settings) and none said end or exit. The session was still in Sick Mode at the end. The house icon was red while the mode was on.
- **Why it matters:** A person who is only looking around, which this task asked for, is left in a recovery state with copy that tells them to end the mode and no control that does it.
- **Evidence:** `screenshots/use_sick_mode-step-02.png`, `use_sick_mode-step-09.png`, `use_sick_mode-step-10.png`, `recover_wrong_tap-step-03.png`

**3. “Done” after “Appointment added” opens a blank new appointment instead of closing.**

- **Kind:** Observed
- **Where:** Appointment success screen
- **What was on screen:** The success screen said “Appointment added,” Dr. Morgan Lee, Fri, Nov 6, 2026 · 2:37 PM, with Done, Add another, and Add more details. Tapping Done returned to step 1, “Who is your appointment with?”, with an empty name field and a pale Continue. The X on that sheet closed it. The calendar then showed one visit: Dr. Morgan Lee, 2:37 PM, Riverside Clinic, on Friday Nov 6. A second visit was not created.
- **Why it matters:** The primary button after a successful save looks like it discarded the visit and asked for the doctor again. The visit was saved, but the screen does not say that.
- **Evidence:** `screenshots/add_appointment-step-26.png`, `add_appointment-step-27.png`, `add_appointment-step-28.png`

### Minor

**4. The text keyboard covers Continue. The dose keypad does not.**

- **Kind:** Observed
- **Where:** Preferred-name step, medication name, appointment doctor name, location
- **What was on screen:** With the text keyboard open, Continue was not on screen. The way forward was the blue keyboard check, then Continue. The dose number pad had its own Done button above the keys, so the amount could be confirmed without hunting.
- **Why it matters:** A first-time user can think the form has no next step until they notice the keyboard key.

**5. The tab bar icons have no words.**

- **Kind:** Observed
- **Where:** Every main screen
- **What was on screen:** Five icons only: house, heart, plus, shield, person. The side menu uses words for the same destinations (Today, Medications, and so on). This persona opened the menu to find Emergency because the icons were not labeled. The shield icon is the Emergency screen. The person icon is You & Settings.
- **Why it matters:** Finding a named place depends on opening the menu or guessing an icon.

**6. There is no screen titled Emergency Card, and the saved medicine did not appear on Emergency.**

- **Kind:** Observed
- **Where:** Menu → Emergency, and the shield tab
- **What was on screen:** Title “Emergency.” Fields for Full Name, Date of Birth, and Current Medications. The medications box said “Add medications in the Medications list” and the caption said “Pulled automatically from your Medications list.” Lisinopril (test) was already saved and did not appear. A tip said to add allergy information in Allergy & Emergency Info “to include it on your Emergency Card.” That tip opened a page titled Allergy & Emergency Info (allergies, EpiPen, consequences), not Emergency Card. Copy on Emergency also said essential emergency information stays available with or without Synapse Plus.
- **Why it matters:** The task name and the in-app tip both say Emergency Card. The screen a person can open does not use that title, and the automatic medication line did not show the medicine just added.
- **Evidence:** `screenshots/find_emergency_card-step-02.png`, `find_emergency_card-step-04.png`

**7. At the default scroll position, the Emergency contact heading sits under the tab bar.**

- **Kind:** Observed
- **Where:** Emergency screen
- **What was on screen:** “Emergency contact” was the last visible heading, flush with the top of the tab bar. No contact field was visible. This session could not scroll that page (see Harness). So this is the resting layout, not a proof that the page cannot scroll.

**8. The medication review does not repeat 8:00 AM.**

- **Kind:** Observed
- **Where:** “Everything look right?” before Save Medication
- **What was on screen:** Lisinopril (test); How: Scheduled, 10 mg · Morning; When: Every day, Reminders on. The clock time was not on that card. After save, the medications list showed “10 mg · 8:00 AM.” The time was correct later. The review step did not show it.

**9. The “add your medications” tip stays up after a medication exists.**

- **Kind:** Observed
- **Where:** Medications list after save
- **What was on screen:** The list showed the new medicine and still showed the coach tip “Add your medications here…” with an X.

**10. Saving an appointment raises the system notification dialog before the success screen.**

- **Kind:** Observed
- **Where:** Appointment review, immediately after Save Appointment
- **What was on screen:** iOS alert “Synapse Would Like to Send You Notifications,” with Don’t Allow and Allow, over the review. Don’t Allow was tapped. The success screen appeared after that. No notification permission was granted.

**11. Back from Allergy & Emergency Info opened You & Settings.**

- **Kind:** Observed
- **Where:** Allergy & Emergency Info, reached from the Emergency tip
- **What was on screen:** The back arrow was tapped. The next screen was You & Settings, with the person tab marked, not the Emergency page. You & Settings also lists Allergy & Emergency Info, so the page is reachable from two places, and back did not return to the place this visit came from.

**12. Plus is marked on every health-record and wellbeing tool, and the first Plus screens do not show a price.**

- **Kind:** Observed
- **Where:** Health Records, Vitals, Wellbeing, You & Settings → Synapse Plus
- **What was on screen:** Health Records rows Vitals, Lab Work, Imaging, Timeline, and Reports each had a Plus badge. Opening Vitals showed “What you can do with Plus” (multiple vitals, history charts, Apple Health import), “Your existing data stays on this device,” and a button “Try Synapse Plus free for 7 days,” plus Not now. No dollar amount was on that screen. Not now returned to the list. No purchase was made. Wellbeing rows (Eating & Hydration, Mental Health Day, Mood Lifters, Goals, Cycle Tracking, Ramadan Mode) also each had a Plus badge. The Synapse Plus settings page said Status: Free, offered Upgrade, a promo code, Restore Purchases (“Reload Plus from this Apple ID”), and Manage Subscription. Prices appeared only after Upgrade.
- **Evidence:** `screenshots/health_records_plus-step-02.png`, `health_records_plus-step-03.png`, `subscription_pricing-step-03.png`, `subscription_pricing-step-04.png`

**13. The heart tab shows a red 1 and no words.**

- **Kind:** Observed
- **Where:** Tab bar after the medication existed
- **What was on screen:** A red badge with 1 on the heart icon. The icon has no label. The medications list at the same time said “Needs attention 1.”

### What went well

- **Onboarding skip is obvious.** The backup step says Not now skips sign-in and that Sign in with Apple can be done later from Backup & Restore. Not now is the filled green button, not a small text link. The welcome screen states that information stays on the device by default.
- **Medication defaults matched a once-daily morning dose.** After the name and the amount 10, the schedule step already had Morning, Every day, reminders on, and 8:00 AM. mg was already selected. The saved row and the success screen both showed Lisinopril (test).
- **The appointment was saved and listed.** Calendar Friday Nov 6 showed Dr. Morgan Lee, 2:37 PM, Riverside Clinic. Home later said “Next: Dr. Morgan Lee · Tomorrow.” Import from Calendar was left unused.
- **A wrong section was easy to leave.** Wellbeing opened from the menu. The house tab returned to the home hub without restarting the app.
- **Pricing and restore were findable, and the trial was avoidable.** The upgrade sheet showed Monthly $4.99/month (7 days free, then $4.99/month), Yearly $49.99/year selected as Best Value (1 week free, then $49.99/year), and Lifetime $129.99 one-time with no free trial. The button on that sheet said Start Free Trial. It was not tapped. The sheet closed with X. Status remained Free.

## Speculation

These were not established by a screen change. Do not treat them as bugs.

- The red 1 on the heart may be the missed morning dose. The icon does not say so. The medications list did say “Needs attention 1” at the same time.
- The green “Sick Mode Active” button that appeared at the top of home, after returning from another section, might turn the mode off. It was not tapped.
- An End Sick Mode control might sit further down the care plan, under the tab bar. This session never scrolled that page, because the scroll command failed.
- Other people may hesitate on the unlabeled tab icons. This persona did open the menu to find Emergency. That does not measure how often a person would guess the shield.

## Harness limits (not product findings)

- **Medication task status “blocked” is a timeout, not a failed save.** The bridge wait is 180 seconds. The dose screen (amount 10, number pad, Done) was not answered in time. The next task’s screenshots show the medicine saved, with 10 mg and 8:00 AM. Do not read the harness status as “the user could not add a medication.”
- **Scroll never ran.** Maestro 2.12.1 rejected the generated flow with `Unknown Property: direction` on the `scroll` step. Emergency, Allergy & Emergency Info, You & Settings, and the Sick Mode care plan therefore stayed at their first position. Absence of a control below the fold was not tested.
- **Some Continue taps missed.** On the appointment wizard the green button center is about 93% of the way down the screen. A tap at 90% hit empty space. That is an aiming miss, not a dead button. The same button worked at its center.
- **This install is a local Release simulator build.** The first launch crashed in expo-updates (“no launchable update”) and, after updates were turned off in the built app, in CloudKit when the binary had no entitlements. The build that ran used an ad-hoc signature with an empty entitlements plist and updates disabled. Source `Expo.plist` was restored and was not committed. Those crashes are install limits for this simulator run, not findings from a TestFlight or App Store launch.
- Elapsed times include the wait for a human-in-the-loop screenshot decision (up to three minutes per step). They are not a measure of how long a person would take.

## Safety check

No Buy, Subscribe, Purchase, or Start Free Trial control was confirmed. Notification permission was Don’t Allow. Sign in with Apple was Not now. No message was sent. No real account, email, or calendar import was used. The name, medicine, doctor, and clinic are the fictional fixtures.

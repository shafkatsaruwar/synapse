# Brag Plan: Synapse

## Planning rubric

1. **What is the app?**
   Synapse is a personal wellness and organization companion that keeps medications, appointments, check-ins, symptoms, vitals, and recovery in one calm place on your iPhone.

2. **What is the funniest or most impressive claim?**
   “Your health command center” — and the quieter flex: “A lot of power, still private.” You control what leaves this device.

3. **What is the visual hook?**
   Warm parchment (`#F5F1EA` / `#F5ECE2`) with maroon `#A30D24` cards on a real iPhone chrome recreation of the dashboard.

4. **What should be shown from the actual UI?**
   Recreated dashboard (greeting, next med, next appointment, “How are you feeling today?”), medications list, and appointments calendar. Fictional stand-in names only — never the real onboarding screenshots.

5. **What is the shortest satisfying video?**
   21 seconds. Hook, product reveal, three grounded highlights, privacy beat, App Store close.

6. **What tone fits best?**
   Preset: `app-store`. User direction: hype it up, stay inside real claims. Nearest preset is app-store with trailer energy, not cinematic overclaim.

7. **What should the audio feel like?**
   Warm upbeat bed (vol-9, ~115 BPM). Tasteful UI SFX on card arrivals. Subtle audio-reactive maroon glow. No voiceover.

8. **What should the share caption say?**
   Synapse is live on the App Store. Medications, appointments, and check-ins — one calm place that stays on your device unless you say otherwise.

9. **What's the user flow worth showing?**
   Open the dashboard (today at a glance) → see today’s meds and next visit → tap the check-in row. Result: the day is organized, still on the phone.

## What is this app?
A personal wellness and organization app for medications, appointments, check-ins, symptoms, vitals, and recovery — local-first on iPhone, with optional iCloud backup and optional Apple Health import.

## The angle
Premium App Store trailer energy for a product that is genuinely calm. The hype is the *density* of real organization (meds, visits, check-ins) plus the privacy posture the product actually claims: it stays on your device unless you turn something on. No HIPAA. No medical advice. No Android-available. No encryption theater.

## Hook (first 2-3 seconds)
Full-bleed parchment. Maroon wordmark energy. The walkthrough line, huge:

**Your health command center.**

## Key moments (the middle)
- Dashboard recreation: “Good evening, Jordan.” Today’s med, next appointment, “How are you feeling today?”
- Medications: scheduled + PRN, dose logging — “4/4 doses taken today”
- Appointments + visit prep on a calendar card
- Privacy: “You control what leaves this device.”

## Outro / punchline
**Synapse.** Personal wellness, organized. On the App Store.

## User flow worth showing
Entry: open Home / dashboard. Key action: today’s meds + next visit already waiting; check-in row invites a tap. Result: one calm snapshot of the health day, still private.

## Tone
- Preset: app-store
- Creative direction: premium App Store trailer — hyped, warm, only real claims
- Interpretation: Feature-card structure and clean slides, but with trailer-scale type and confident holds. Excitement comes from showing the real product, not from invented capabilities.

## Format: landscape — 1920x1080
## Duration: 21 seconds

## Visual identity (from the project)
- Background: `#F5F1EA` (calm parchment `#F5ECE2` as secondary)
- Accent: `#A30D24`
- Text: `#1A1A1A`
- Secondary text: `#68645F`
- Surface green (done states): `#2D7D46`
- Display font: SF Pro / system-ui (the app uses the iOS system stack; fallback: Inter)
- Body font: SF Pro / system-ui
- Strongest visual element: glass-cream cards on parchment, maroon plus button, “How are you feeling today?” row
- Product assets (reference only, do not composite raw PHI screenshots): `synapse-reset/assets/icon.png`, onboarding UI layout language from `dashboard.png` / `medications.png` / `appointments.png`

## Fictional stand-ins (required)
Onboarding screenshots contain real-looking names. Recreate UI with:
- Greeting: Jordan
- Medication: Lisinopril 10 mg · Morning
- Appointment: Dr. Rivera · Thu 10:00 AM · Riverside Clinic
- Date line: Tuesday, March 10

## Claims lock (must stay inside)
**May say:** personal wellness and organization; medications (scheduled + PRN, dose logging, reminders); appointments and visit prep; daily check-ins / symptoms / vitals / recovery; local-first, stays on this device; optional iCloud backup; optional Apple Health import (read-only); Face ID lock; iOS widgets; available on the App Store.

**Must not say:** HIPAA; medical advice; medical device; healthcare provider; AES-256 / encrypted storage; Android available; writes to Apple Health; diagnoses; replaces a clinician.

## Share copy (draft)
Synapse is live on the App Store. Medications, appointments, and check-ins — one calm place that stays on your device unless you say otherwise.

## Audio direction
- Role: warm bed
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (~114.84 BPM)
- Music treatment: start at 0s, volume ~0.22, short fade-in (~0.4s), fade under the final logo from ~19.0s
- Music cue guidance: bundled preset `.agents/skills/brag/assets/music/cues/happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.md`. Strong cues in window: 3.70, 4.23, 6.34, 10.54, 12.65. Target: dashboard reveal ~4.23s; meds card ~6.34s; privacy line ~12.65s. Sequential feature chips on beat grid 8.44 / 8.96 / 9.50 (hold the full set afterward).
- Audio-reactive treatment: subtle; maroon glow and phone-card presence breathe with RMS/bass. No waveform bars.
- SFX posture: sparse-to-moderate; motion-matched; professional restraint
- Audio-coupled moments: hook type-on or slam-in; phone landing; three feature chips sequential; tap on check-in row; logo hit
- Restraint rule: no chaotic hits, no medical-monitor beeps, no voiceover

## Storyboard

### Scene 1 — Hook — 3.2s
Parchment full-bleed. Tiny “SYNAPSE” eyebrow in maroon. Then the walkthrough title slams in and holds:

**Your health command center.**

Sequential/interaction: yes — eyebrow, then headline
Audio intent: confident lift
Audio-coupled idea: slam-in on a nearby beat, then hold for reading (~1.8s settled)
Music: warm bed in
Transition mood: clean slide → Scene 2

### Scene 2 — Reveal the day — 4.6s
iPhone frame, dashboard recreation (fictional Jordan). Greeting, next med (Lisinopril), next appointment (Dr. Rivera), then the real product row **How are you feeling today?** A cursor/finger taps that row.
Sequential/interaction: yes — cards settle, then a simulated tap on the check-in row
Audio intent: product-in-hand warmth
Audio-coupled idea: phone lands ~4.23s (strong cue); tap click on the check-in row
Transition mood: clean slide → Scene 3

### Scene 3 — Medications — 3.8s
Feature label **Medications** + supporting line grounded in the walkthrough: scheduled meds, PRNs, dose history. Phone shifts to a medications list (4/4 doses taken today). One dose row ticks complete.
Sequential/interaction: yes — list rows, then a taken-dose check
Audio intent: satisfying, organized
Audio-coupled idea: card-place on list; soft confirm on the check
Transition mood: clean slide → Scene 4

### Scene 4 — Appointments & check-ins — 3.8s
Split feature cards, App Store style:
- **Appointments** — visits, notes, visit prep
- **Daily logging** — energy, mood, sleep, symptoms
Phone calendar card (fictional Dr. Rivera) sits beside them.
Sequential/interaction: yes — two feature chips arrive one by one (every other beat, then hold)
Audio intent: clean feature-card rhythm
Audio-coupled idea: two card arrivals on 10.54-adjacent beats
Transition mood: soft wipe → Scene 5

### Scene 5 — Still private — 2.8s
No phone. Large grounded line from Privacy:

**You control what leaves this device.**

Smaller supporting line (grounded): optional iCloud. Optional Apple Health. You turn them on.
Sequential/interaction: none — one thought, hold
Audio intent: quieter confidence
Audio-coupled idea: privacy line near 12.65s strong cue, then hold
Transition mood: clean slide → Scene 6

### Scene 6 — Outro — 2.8s
App icon + **Synapse**. Tagline: **Personal wellness, organized.** CTA: **On the App Store.**
Sequential/interaction: icon then name then CTA
Audio intent: logo land, music fade
Audio-coupled idea: logo hit; music fades under
Transition mood: hold to end

**Duration check:** 3.2 + 4.6 + 3.8 + 3.8 + 2.8 + 2.8 = **21.0s**

**Music mood for this video:** upbeat / warm professional
**Audio summary:** Warm 115-BPM bed, three strong-cue locks, sparse UI SFX, fade under the App Store close.

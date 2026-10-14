# Hyperframes Composition Brief: Synapse

## Objective
Create a short launch-style brag video for Synapse, hyped like a premium App Store trailer but locked to claims the product actually makes.

## Output
- Composition directory: `brag-output-2026-10-14-010220/composition/`
- Rendered video: `brag-output-2026-10-14-010220/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 21 seconds

## Source Material
- Project root: `/workspace`
- Primary files read: `README.md`, `synapse-reset/app.config.js`, `synapse-reset/screens/PrivacyScreen.tsx`, `synapse-reset/components/AppWalkthrough.tsx`, `synapse-reset/screens/DashboardScreen.tsx`, `synapse-reset/constants/colors.ts`, `synapse-reset/SECURITY.md`, onboarding screenshots (layout language only)
- Product name: Synapse
- Tagline / strongest claim: Your health command center. / You control what leaves this device.
- Key UI or visual moment to recreate: Dashboard today-at-a-glance (greeting, next med, next appointment, “How are you feeling today?”), medications list, appointments calendar — fictional stand-ins only
- Copy that must appear verbatim:
  - Your health command center
  - How are you feeling today?
  - Today is a good day to be kind to your body.
  - You control what leaves this device.
  - Synapse
  - On the App Store

## Creative Direction
- Tone preset: app-store
- Creative direction: premium App Store trailer — hyped, warm, only real claims
- Interpretation: Feature-card structure, clean slides, trailer-scale type. Excitement from showing the real product, not invented capabilities.
- Angle: The flex is density of real organization plus a privacy posture the product actually claims.
- Hook: Your health command center.
- Outro / punchline: Synapse. Personal wellness, organized. On the App Store.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - HIPAA / medical advice / medical device / AES-256 / Android-available / writes-to-Apple-Health claims
  - Real names from onboarding screenshots (Mohammed, Sogroya, Dr. Khalaf). Use Jordan / Lisinopril / Dr. Rivera.

## Visual Identity
- Background: `#F5F1EA`
- Text: `#1A1A1A`
- Accent: `#A30D24`
- Display font: system-ui / -apple-system (no webfont — matches iOS app)
- Body font: system-ui / -apple-system
- Visual references from the project: parchment canvas, maroon plus/tint, cream glass cards, iPhone chrome, app icon at `synapse-reset/assets/icon.png`

## Storyboard
Use the storyboard in `brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 3.2s — “Your health command center.”
2. Reveal the day — 4.4s — dashboard phone, tap check-in row. Phone lands ~4.23s.
3. Medications — 3.6s — scheduled + PRN, 4/4 doses, one check.
4. Appointments & check-ins — 3.8s — two feature chips + calendar card. Lock ~12.65s.
5. Still private — 3.0s — “You control what leaves this device.”
6. Outro — 3.0s — icon, Synapse, On the App Store. Logo ~18.44s.

## Audio
- Audio role: warm bed
- Audio arc: fade in, hold, fade under the logo
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3`
- Music treatment: volume ~0.22, 0.4s fade-in, fade from 19.0s
- Music cue guidance: bundled preset at `.agents/skills/brag/assets/music/cues/happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.md`. Strong locks: 4.23 phone, 12.65 appointments, 18.44 logo.
- Audio-reactive treatment: subtle; maroon glow + phone presence from RMS/bass
- Audio-coupled moments:
  - Scene 1 headline — slam-in
  - Scene 2 phone land — major reveal
  - Scene 2 check-in tap — click
  - Scene 3 dose check — soft confirm
  - Scene 4 chips — sequential card arrivals
  - Scene 6 logo — isolated hit
- SFX selection guidance: low-HF impactSoft_medium + interface clicks; avoid bright casino repeats
- SFX analysis guidance: `.agents/skills/brag/assets/sfx/sfx-analysis.md`
- Exact SFX choice: Hyperframes should choose filenames after animation exists
- Audio files: copy into `composition/assets/`

## Hyperframes Instructions
Load hyperframes-core, hyperframes-animation, hyperframes-creative, hyperframes-keyframes, hyperframes-cli. /brag owns the angle; do not enter the generic Hyperframes promo interview.

Requirements:
- Show recreated Synapse UI (not raw PHI screenshots)
- Keep all text readable
- 15–25 seconds (target 21)
- Music + sparse SFX
- Beat-lock 1–3 major moments; mark `// beat-locked` and `// beat-grid`
- Subtle audio-reactive glow
- `npx hyperframes check` must pass
- Local render only

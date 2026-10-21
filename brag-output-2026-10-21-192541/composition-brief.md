# Hyperframes Composition Brief: Synapse Health Companion

## Objective
Create a 15-second vertical Apple-style product ad where scattered Synapse Today UI panels magnetically assemble into the real homepage.

## Output
- Composition directory: `brag-output-2026-10-21-192541/composition/`
- Rendered video: `brag-output-2026-10-21-192541/brag.mp4`
- Format: vertical — 1080×1920
- Duration: 15 seconds
- Frame rate: 30 fps

## Source Material
- Project root: `/workspace` (active product: `synapse-reset/`)
- Primary files read:
  - `synapse-reset/screens/DashboardScreen.tsx` (Today layout)
  - `synapse-reset/themes/light.ts`, `constants/soft-card.ts`
  - `synapse-reset/components/SidebarLayout.tsx` (bottom nav)
  - `synapse-reset/lib/navigation-registry.ts`
  - User-supplied UI crops of greeting, Medications, Sick Mode, How I’m Feeling, bottom nav
- Product name: Synapse Health Companion
- Tagline / strongest claim: Your health life, finally in one place.
- Key UI to recreate: Today homepage SoftCard stack + full-mode bottom nav
- Copy that must appear verbatim:
  - Medications / Your daily schedule / UP NEXT / View
  - How I’m Feeling / A moment to check in
  - Sick Mode / Quick access when you need recovery support
  - Your health life, finally in one place.
  - Available on the App Store.

## Creative Direction
- Tone preset: polished
- Creative direction: Apple-style product commercial; soft white studio; translucent glass; burgundy accents; magnetic assembly
- Interpretation: deterministic 3D transforms; no AI-approximated UI; reconstruct from design tokens
- Angle: scattered tools → one Synapse homepage
- Hook: floating independent panels
- Outro: logo + tagline + App Store
- Avoid: generic SaaS language, invented features, real PHI, modifying production app

## Visual Identity
- Background: `#F5F6F8` studio with soft burgundy radial wash
- Text: `#111111` / `#68645F` / `#9A948D`
- Accent: `#A30D24`
- Display/body font: system-ui / -apple-system
- Visual references: Soft Evergreen cards, tint icons, Quick Add burgundy FAB

## Storyboard
1. Fragmented — 3s — separate glass panels in 3D space
2. Unified — 5s — panels snap into Today homepage
3. Product reveal — 4s — front-facing assembled UI
4. Brand reveal — 3s — logo + tagline + App Store

## Audio
- Audio role: sparse professional accents + quiet bed under VO
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: soft bed, duck under VO to ~0.12, fade on brand
- Music cue guidance: vol-12 bundled cues; optional locks ~3.27s, ~8.74s
- Audio-reactive treatment: subtle studio glow only
- Voiceover: Kokoro `af_heart` — three lines in `assets/voiceover.wav`
- SFX: soft interface drops/switches on panel locks; quiet logo hit
- SFX analysis: prefer low HF-risk files from brag sfx-analysis

## Hyperframes Instructions
Load hyperframes-core, hyperframes-animation, hyperframes-creative, hyperframes-keyframes, hyperframes-cli. Do not enter generic promo interview.

Requirements:
- Reconstruct UI from Synapse tokens/layout (not screenshots as sole motion source)
- Deterministic GSAP timeline; seek-safe; no random
- CSS 3D perspective stage for panel assembly
- Voiceover track + ducked music
- `npx hyperframes check` before render
- Draft/low-res preview before final high-quality render
- Do not edit files under `synapse-reset/` production app paths for this deliverable

# App Review Notes — Synapse Plus (paste into App Store Connect)

## Overview

Synapse Health Companion is a personal health organization app. This update introduces **Synapse Plus**, an optional App Store in-app purchase that unlocks additional tracking and records tools. Core care workflows remain free.

## Free features (no purchase required)

- Medications (schedules, doses, reminders)
- Appointments and preparation notes
- Sick Mode
- Basic Emergency Card (allergies, medications, emergency contacts, and essential medical details already entered remain visible)
- Profile, allergy info, privacy controls, backup/export tools

## Synapse Plus features

- How I’m Feeling (daily log, symptoms, monthly check-in)
- Health Records (vitals, labs, imaging, timeline, reports)
- Wellbeing tools
- Check-In
- Care & Support (doctors, pharmacies, care connections)
- Advanced Emergency Card helpers (export / save to Photos)

All Plus purchase options unlock the **same** entitlement (`synapse_plus`).

## Products

- `com.synapse.monthly` — auto-renewable, 7-day free introductory offer
- `com.synapse.yearly` — auto-renewable, 7-day free introductory offer (same subscription group)
- `com.synapse.plus.lifetime` — non-consumable, **no** free trial

Paywall prices are loaded from StoreKit (not hardcoded). Trial disclosure example: “7 days free, then {localized price}/year. Cancel anytime.” Lifetime CTA: “Unlock Lifetime Access.”

## How to test Plus

1. Sign in with a Sandbox Apple ID on a device / TestFlight build that includes this binary.
2. Open **Health** → any Plus-marked row (for example How I’m Feeling → Daily Log), or **You & Settings → Synapse Plus**.
3. Use **Start Free Trial** / **Unlock Lifetime Access**, or **Restore Purchases**.
4. Manage / cancel via the in-app **Manage Subscription** control (opens Apple subscription management).

No account login is required to use the app or to purchase Plus. Optional sign-in exists only for optional cloud/assistant features and is not required for Review.

## Privacy & support URLs

- Privacy Policy: https://synapse-health.vercel.app/privacy
- Support: https://synapse-health.vercel.app/support
- Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

## Safety note

Essential Emergency Card information is never hidden or deleted when a subscription expires. Existing user health records are preserved regardless of entitlement state.

## Existing members

Installs that already had Synapse data before this update receive a temporary transition period with Plus access so the change is not a sudden block. New installs see the free/Plus split immediately.

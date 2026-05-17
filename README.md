# Synapse

A health management app built with Expo and React Native.

Synapse is designed to help users manage medications, appointments, symptoms, recovery, and personal health details in one place. The repo includes the active mobile app, supporting backend and web infrastructure, and an archived legacy Expo app kept only for reference.

The current source of truth for product work is `synapse-reset`.

## App Availability

### iOS
https://apps.apple.com/us/app/synapse-health-companion/id6759972036

### Android
Android support is in progress.

## Features

- Medication management
  - Scheduled and PRN medications
  - Dose logging and reminder flows
  - Repeat schedules, refill data, and pharmacy info
- Health tracking
  - Symptoms, daily logs, and recovery tracking
  - Health profile and emergency information
  - Timestamped health entries
- Appointments
  - Appointment scheduling and status tracking
  - Doctor notes and visit prep
  - Calendar and picker improvements
- Widgets and native iOS support
  - iPhone home screen widgets
  - Native iOS and Android project folders committed for stability
  - EAS build and CocoaPods already wired in
- Cross-platform app
  - Expo Router app structure
  - iOS, Android, and web support
  - Local config with production-safe fallbacks

## Project Structure

```text
Synapse/
├── README.md                   # GitHub project overview
├── package.json                # Root scripts and shared tooling
├── eas.json                    # Root EAS configuration
├── api/                        # API routes and related server logic
├── server/                     # Backend/server entrypoints
├── shared/                     # Shared app/server types and logic
├── supabase/                   # Supabase-related files
├── synapse-reset/              # Active Expo app (main product)
│   ├── app/                    # Expo Router routes
│   ├── components/             # Reusable UI components
│   ├── contexts/               # App-level state and context
│   ├── lib/                    # Storage, notifications, and helpers
│   ├── screens/                # Main screen implementations
│   ├── ios/                    # Native iOS project
│   ├── android/                # Native Android project
│   ├── app.config.js           # Expo app configuration
│   └── package.json            # App-specific scripts and dependencies
└── legacy/root-expo-app/       # Archived legacy app, not for active work
```

## Getting Started

### Prerequisites

- Node.js and npm
- Xcode for iOS development
- Android Studio for Android development
- Expo CLI tooling through `npx expo`

### Installation

1. Clone the repository.
2. Install root dependencies:

```bash
npm install
```

3. Install active app dependencies if needed:

```bash
cd synapse-reset
npm install
```

## Running the App

From the repo root:

```bash
npm start
```

Or launch specific platforms:

```bash
npm run ios
npm run android
npm run web
```

If you want to work directly inside the active app:

```bash
cd synapse-reset
npm run start
```

## Development Notes

1. The active app lives in `synapse-reset`.
2. `legacy/root-expo-app` is archived and should not get new product work.
3. Root-level scripts still support shared tooling and infrastructure.
4. App config loads from `synapse-reset/.env` first, then falls back to the repo root `.env`.

## Tech Stack

- Expo SDK 54
- React Native 0.81
- React 19
- Expo Router
- Supabase
- TypeScript
- EAS Build

## Current State

- Active mobile app version target in config: `1.11`
- Primary app package: `synapse-reset`
- Native iOS and Android folders are present for platform-specific work
- Archived legacy app is kept for reference only

## Future Improvements

- Add screenshots or product GIFs
- Tighten setup and release docs
- Document environment variables in one place
- Add a contributor guide for app structure and ownership

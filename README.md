Synapse
📌 Overview
Synapse is a health management app built with Expo and React Native. It is designed to help users track medications, appointments, symptoms, recovery, and personal health details in one place.

This repo contains the active mobile app, supporting backend and web infrastructure, and an archived legacy Expo app kept only for reference.

With Synapse, you can:

Track medications, including repeat schedules and PRN meds
Log symptoms, recovery progress, and daily health activity
Manage appointments, doctor notes, and health records
Use iPhone home screen widgets for quick health info
Run the app on iOS, Android, and web through Expo
The current source of truth for product work is the synapse-reset app.

⚙️ Features
Medication Management

Scheduled and PRN medications
Dose logging and reminder flows
Repeat rules, refill-related data, and pharmacy info
Health Tracking

Symptoms, daily logs, and recovery tracking
Health profile and emergency-related information
Exact timestamps for important entries
Appointments

Appointment scheduling and status tracking
Doctor notes and visit prep
Better picker and calendar flows
Widgets and Native iOS Support

iPhone home screen widgets
Native iOS project files committed for build stability
EAS build and CocoaPods setup already wired in
Cross-Platform App

Expo Router based app structure
iOS, Android, and web support
Local config with production-safe fallbacks
📁 Project Structure
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
│   ├── contexts/               # App-level state/context
│   ├── lib/                    # Storage, notifications, helpers
│   ├── screens/                # Main screen implementations
│   ├── ios/                    # Native iOS project
│   ├── android/                # Native Android project
│   ├── app.config.js           # Expo app configuration
│   └── package.json            # App-specific scripts and deps
└── legacy/root-expo-app/       # Archived legacy app, not for active work
🚀 Getting Started
Prerequisites
Node.js and npm
Xcode for iOS development
Android Studio for Android development
Expo CLI tooling through npx expo
Installation
Clone this repository
Install dependencies at the repo root:
npm install
Install dependencies for the active app if needed:
cd synapse-reset
npm install
Usage
Run the active app from the repository root:

npm start
Or launch specific platforms:

npm run ios
npm run android
npm run web
If you want to work directly inside the active app:

cd synapse-reset
npm run start
🧪 Development Notes
The active app lives in synapse-reset/. That is the folder you should treat as the real app.
The legacy/root-expo-app/ directory is archived. Don’t build new product work there.
Root-level scripts still help with shared tooling, web export, and infrastructure.
App config loads environment values from synapse-reset/.env first, then falls back to the repo root .env.
🛠️ Tech Stack
Expo 54
React Native 0.81
React 19
Expo Router
Supabase
TypeScript
EAS Build
🌱 Current State
Active mobile app version target in config: 1.11
Primary app package: synapse-reset
Archived legacy app kept for reference only
Native iOS and Android folders are present for platform-specific work
🔮 Future Improvements
Tighten repo docs so setup is even more obvious for new contributors
Add screenshots or product GIFs to show the app properly
Document environment variables and release flow in one place
Add a contributor guide for app structure and feature ownership

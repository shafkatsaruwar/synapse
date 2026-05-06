# 🧠 Synapse

> A cross-platform health management app built with Expo and React Native.

Synapse is designed to help users manage medications, appointments, symptoms, recovery progress, and personal health information in one place through a clean, accessible, and widget-focused experience.

Built with a strong focus on usability and real-world healthcare workflows, Synapse combines mobile accessibility, automation, and modern cross-platform development into a single ecosystem.

---

## 📱 App Availability

### iOS
https://apps.apple.com/us/app/synapse-health-companion/id6759972036

### Android
Android support is currently in development and coming soon.

---

# ✨ Features

## 💊 Medication Management
- Scheduled and PRN medication support
- Dose logging and medication reminders
- Repeat schedules and refill tracking
- Pharmacy and prescription-related information

---

## 🩺 Health Tracking
- Symptom and recovery logging
- Daily health activity tracking
- Health profile and emergency information
- Timestamped health entries

---

## 📅 Appointments
- Appointment scheduling and tracking
- Doctor notes and visit preparation
- Improved picker and calendar flows

---

## 📲 Widgets & Native iOS Support
- iPhone home screen widgets
- Native iOS project support for build stability
- EAS Build and CocoaPods integration already configured

---

## 🌐 Cross-Platform Support
- Built using Expo Router
- Supports iOS, Android, and Web
- Production-safe local configuration fallbacks

---

# 🏗️ Project Structure

```bash
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
└── legacy/root-expo-app/       # Archived legacy app
```

---

# 🚀 Getting Started

## Prerequisites

Before running the project, make sure you have:

- Node.js
- npm
- Xcode (for iOS development)
- Android Studio (for Android development)
- Expo CLI tooling through `npx expo`

---

## Installation

Clone the repository:

```bash
git clone YOUR_REPO_URL
```

Install dependencies at the repository root:

```bash
npm install
```

Install dependencies for the active app if needed:

```bash
cd synapse-reset
npm install
```

---

# ▶️ Running the App

From the repository root:

```bash
npm start
```

Run specific platforms:

```bash
npm run ios
npm run android
npm run web
```

Or work directly inside the active app:

```bash
cd synapse-reset
npm run start
```

---

# 🧪 Development Notes

- The active application lives inside `synapse-reset/`
- `legacy/root-expo-app/` is archived and no longer used for active development
- Root-level scripts help manage shared tooling and infrastructure
- Environment values load from `synapse-reset/.env` first, then fall back to the root `.env`

---

# 🛠️ Tech Stack

- Expo SDK 54
- React Native 0.81
- React 19
- Expo Router
- Supabase
- TypeScript
- EAS Build

---

# 🌱 Current State

- Active app version target: `1.11`
- Main product package: `synapse-reset`
- Native iOS and Android folders included
- Android version currently under active development
- Legacy Expo app archived for reference only

---

# 🔮 Future Improvements

- Improve contributor onboarding documentation
- Add screenshots and product GIFs
- Document environment variables and deployment flow
- Add contributor and architecture guides
- Expand Android-specific functionality
- Continue improving accessibility and health workflow features

---

# 👨‍💻 About the Project

Synapse started as a personal project focused on simplifying healthcare management and improving accessibility through technology.

The app continues to evolve around one core idea:

> Health information should feel accessible, organized, and human.

---

# 📬 Contact

- GitHub: https://github.com/shafkatsaruwar

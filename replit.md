# Fir Health

## Overview

Fir is a personal health tracking mobile application built with Expo (React Native) and an Express backend. It allows users to log daily health metrics (energy, mood, sleep), track medications, record symptoms, manage appointments with doctor notes, and generate health reports. The app has a dark-themed UI with sidebar navigation and supports both mobile and wider screen layouts. It includes a Ramadan/fasting mode for users who observe religious fasting.

## User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Apple-inspired, calm, minimal dark mode UI. Not playful, not cartoonish, not 90s UI. Emphasis on calm, intelligent, emotionally supportive interface.

## System Architecture

### Frontend (Expo / React Native)
- **Framework**: Expo SDK 54 with React Native 0.81, using the new architecture (`newArchEnabled: true`) and React Compiler experiment
- **Routing**: expo-router v6 with typed routes and file-based routing under `app/` directory
- **Navigation Pattern**: Single-page app approach — the `app/(tabs)/index.tsx` renders a `SidebarLayout` component that manages screen switching via state rather than using native tab/stack navigation for the main screens. The sidebar switches between: Dashboard, Daily Log, Medications, Symptoms, Appointments, Reports, and Settings
- **Screen Components**: Located in `screens/` directory (not in the `app/` routing directory). These are plain React components rendered conditionally by the main index screen
- **Layout Component**: `components/SidebarLayout.tsx` — shows a sidebar on wide screens (768px+) and bottom tab navigation on mobile
- **State Management**: Local component state with React's `useState` and `useCallback`. Data fetching from local storage uses direct async calls in `useEffect`
- **Data Persistence (Client)**: AsyncStorage (`@react-native-async-storage/async-storage`) via a custom storage abstraction in `lib/storage.ts`. Each entity type (HealthLog, Symptom, Medication, MedicationLog, Appointment, DoctorNote, FastingLog, Vital, UserSettings) has its own storage helper
- **Server Communication**: TanStack React Query with a custom `apiRequest` helper in `lib/query-client.ts` that calls the Express backend. Uses `expo/fetch` for network requests
- **Fonts**: Inter font family (400, 500, 600, 700 weights) via `@expo-google-fonts/inter`
- **UI Libraries**: react-native-gesture-handler, react-native-reanimated, react-native-safe-area-context, react-native-screens, expo-haptics, expo-blur, expo-linear-gradient, expo-image
- **Styling**: Dark theme only (defined in `constants/colors.ts`), uses StyleSheet.create patterns, responsive layouts with `useWindowDimensions` (breakpoint at 768px for wide/desktop layouts)

### Backend (Express)
- **Framework**: Express 5 running on Node.js
- **Entry Point**: `server/index.ts` — sets up CORS (allows Replit domains and localhost), JSON parsing, and registers routes
- **Routes**: `server/routes.ts` — currently minimal, creates an HTTP server. Routes should be prefixed with `/api`
- **Storage Layer**: `server/storage.ts` — defines an `IStorage` interface with an in-memory implementation (`MemStorage`) for users

### Database Schema
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` — shared between frontend and backend
- **Current Tables**: 
  - `users` — id (UUID, auto-generated), username (unique text), password (text)
- **Note**: Most app data (health logs, medications, symptoms, etc.) is currently stored client-side in AsyncStorage, not in PostgreSQL.

### Build & Deployment
- **Dev Mode**: Two processes — `expo:dev` for the mobile/web client and `server:dev` for the Express backend
- **Proxy**: In development, the Expo packager proxy is configured through Replit domain environment variables
- **Landing Page**: `server/templates/landing-page.html` — served in production as the web entry point

### Key Design Decisions
1. **Client-side storage vs. server database**: Health data is stored locally on the device using AsyncStorage rather than synced to the server. Provides offline-first capability.
2. **Single screen with sidebar navigation**: Instead of using expo-router's native navigation for each screen, the app uses a single route with a sidebar component that conditionally renders screens.
3. **Dark theme only**: The color constants only define dark theme values, and the UI is built around a dark aesthetic.
4. **Responsive layout**: Sidebar on wide screens (768px+), bottom tabs on mobile.

## Recent Changes
- 2026-02-23: Redesigned app from "Seha" to "Fir" with Apple-inspired dark mode aesthetic
- 2026-02-23: Replaced native tabs with sidebar navigation (desktop) + bottom tabs (mobile)
- 2026-02-23: Built 7 screens: Dashboard, Daily Log, Medications, Symptoms, Appointments, Reports, Settings
- 2026-02-23: Added Ramadan/fasting mode with suhoor/iftar tracking
- 2026-02-23: Added symptoms tracking with frequency analysis
- 2026-02-23: Added vitals monitoring in Settings
- 2026-02-23: Added health report generation and sharing
- 2026-02-23: Added Sick Mode with stress dosing protocol (3x Hydrocortisone), guided recovery section
- 2026-02-23: Rebuilt Medications screen with emoji support, editable cards via modal, multi-dose tracking (AM/PM), dose-based progress bar
- 2026-02-23: Added Recovery Protocol section: hydration tracker (2000mL goal), food/rest checklists, PRN Tylenol with 4hr countdown, temperature logging with fever alerts, symptom toggles
- 2026-02-23: Added warning color theme — red banner on Dashboard when Sick Mode active, red medication card with "Stress Dosing" label
- 2026-02-23: Storage layer updated with SickModeData interface, sickMode field in UserSettings, doseIndex in MedicationLog

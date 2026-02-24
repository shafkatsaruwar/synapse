# Synapse Health

## Overview

Synapse is a personal health tracking mobile application built with Expo (React Native) and an Express backend. It allows users to log daily health metrics (energy, mood, sleep), track medications, record symptoms, manage appointments with doctor notes, and generate health reports. The app has a warm beige/maroon themed UI with sidebar navigation and supports both mobile and wider screen layouts. It includes a Ramadan/fasting mode for users who observe religious fasting.

## User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Apple-inspired, calm, minimal warm beige/maroon UI. Not playful, not cartoonish, not 90s UI. Emphasis on calm, intelligent, emotionally supportive interface. San Francisco system font (no custom font imports — uses fontWeight for system font rendering). Warm beige (#FAE8D1) background, maroon (#800020) accent color. Cards have beige background, thin maroon border, light shadow, rounded corners. Primary buttons: maroon bg/white text. Secondary buttons: beige bg/maroon border/maroon text. Black primary text, soft dark brown secondary text.

## System Architecture

### Frontend (Expo / React Native)
- **Framework**: Expo SDK 54 with React Native 0.81, using the new architecture (`newArchEnabled: true`) and React Compiler experiment
- **Routing**: expo-router v6 with typed routes and file-based routing under `app/` directory
- **Navigation Pattern**: Single-page app approach — the `app/(tabs)/index.tsx` renders a `SidebarLayout` component that manages screen switching via state rather than using native tab/stack navigation for the main screens. The sidebar switches between: Dashboard, Daily Log, Medications, Symptoms, Appointments, Reports, and Settings
- **Screen Components**: Located in `screens/` directory (not in the `app/` routing directory). These are plain React components rendered conditionally by the main index screen
- **Layout Component**: `components/SidebarLayout.tsx` — shows a sidebar on wide screens (768px+) and bottom tab navigation on mobile. Uses SynapseLogo component for branding.
- **Logo**: `components/SynapseLogo.tsx` — SVG-based minimal synapse icon with two circles and connecting signal line, rendered in maroon
- **State Management**: Local component state with React's `useState` and `useCallback`. Data fetching from local storage uses direct async calls in `useEffect`
- **Data Persistence (Client)**: AsyncStorage (`@react-native-async-storage/async-storage`) via a custom storage abstraction in `lib/storage.ts`. Each entity type (HealthLog, Symptom, Medication, MedicationLog, Appointment, DoctorNote, FastingLog, Vital, UserSettings) has its own storage helper
- **Server Communication**: TanStack React Query with a custom `apiRequest` helper in `lib/query-client.ts` that calls the Express backend. Uses `expo/fetch` for network requests
- **Fonts**: San Francisco system font (no custom font imports — uses fontWeight for system font rendering)
- **UI Libraries**: react-native-gesture-handler, react-native-reanimated, react-native-safe-area-context, react-native-screens, expo-haptics, expo-blur, expo-linear-gradient, expo-image, react-native-svg
- **Styling**: Warm beige/maroon theme (defined in `constants/colors.ts`), uses StyleSheet.create patterns, responsive layouts with `useWindowDimensions` (breakpoint at 768px for wide/desktop layouts)

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
3. **Warm beige/maroon theme**: Color constants define beige background (#FAE8D1) with maroon (#800020) accent. Cards, buttons, and UI elements use this warm palette.
4. **Responsive layout**: Sidebar on wide screens (768px+), bottom tabs on mobile.
5. **System font**: Uses San Francisco system font via fontWeight (no custom font imports needed).

## Recent Changes
- 2026-02-24: Rebranded app from "Fir" to "Synapse" with new visual identity
- 2026-02-24: Implemented warm beige (#FAE8D1) background and maroon (#800020) accent color system
- 2026-02-24: Created SynapseLogo component: minimal synapse icon with two circles and connecting signal line using SVG
- 2026-02-24: Migrated typography from Inter font family to San Francisco system font
- 2026-02-24: Updated design system: beige cards with thin maroon borders, maroon primary buttons, beige secondary buttons
- 2026-02-24: Updated SidebarLayout with Synapse branding (logo + name in header/sidebar)
- 2026-02-24: Updated OnboardingScreen with Synapse branding, maroon accent colors, larger text sizes
- 2026-02-24: Updated all screens (Dashboard, Medications, SickMode, Privacy) with new color scheme
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
- 2026-02-23: Dedicated SickModeScreen recovery dashboard: replaces Dashboard when active, stress dosing card, temperature logger, recovery checklist with progress bar, "I'm better" exit button, manual activation from Dashboard, auto-trigger on fever ≥100°F, dimmed non-essential nav
- 2026-02-23: Added first-launch onboarding flow (12 screens): Welcome, Name input, Health Setup (medications + conditions), 6-screen founder story with progress dots. Saves onboardingCompleted flag to skip on subsequent launches

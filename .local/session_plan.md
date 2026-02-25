# Objective
Replace the static preset "Conditions" chip list from Settings with a dynamic, searchable, user-managed Conditions system. Create a dedicated HealthProfileConditionsScreen accessible from Settings → Health Profile → Conditions. Remove conditions selection from onboarding.

# Tasks

### T001: Create conditions dataset and storage layer
- **Blocked By**: []
- **Details**:
  - Create `constants/conditions.json` with ~50 conditions (ICD-style ids, names)
  - In `lib/storage.ts`, create `HealthCondition` interface: { id, name, source: "database"|"custom", dateAdded: string, notes?: string, requiresStressDose?: boolean }
  - Create `conditionStorage` helper: getAll, save, update, delete, using AsyncStorage key
  - Files: `constants/conditions.json`, `lib/storage.ts`
  - Acceptance: Interface compiles, storage CRUD works

### T002: Create HealthProfileConditionsScreen
- **Blocked By**: [T001]
- **Details**:
  - Create `screens/HealthProfileConditionsScreen.tsx`
  - Props: `onBack?: () => void`
  - Empty state: "No conditions added" + "+ Add Condition" button
  - With conditions: vertical list, each item shows name, notes indicator icon, edit/delete actions
  - "+ Add Condition" floating or bottom button
  - Add Condition modal: search input, results from conditions.json, "Add custom condition" when no exact match, on select → ask "Does this require stress dosing when sick?" toggle → save
  - Edit Condition modal: edit notes, toggle stress dose, delete
  - Back button to return to Settings
  - All accessibility requirements (44px targets, labels, roles)
  - Style consistent with app theme (beige/maroon)
  - Files: `screens/HealthProfileConditionsScreen.tsx`
  - Acceptance: Can add/edit/delete conditions, search works, stress dose toggle works

### T003: Wire up navigation and update Settings/Onboarding
- **Blocked By**: [T002]
- **Details**:
  - In `app/(tabs)/index.tsx`: import HealthProfileConditionsScreen, add case in renderScreen, pass handleNavigate
  - In `screens/SettingsScreen.tsx`:
    - Accept `onNavigate` prop
    - Replace the Conditions chip grid with a "Health Profile" card containing a "Conditions" row that navigates to "healthprofileconditions" screen
    - Show count of conditions added
    - Remove COMMON_CONDITIONS const and toggleCondition function
  - In `app/(tabs)/index.tsx`: pass onNavigate to SettingsScreen
  - In `screens/OnboardingScreen.tsx`: Remove the conditions selection step (step 3). Keep medications step. Adjust step numbering/total
  - Update `screens/DashboardScreen.tsx` if it references `settings.conditions` — it should now read from `conditionStorage` instead
  - Files: `app/(tabs)/index.tsx`, `screens/SettingsScreen.tsx`, `screens/OnboardingScreen.tsx`, `screens/DashboardScreen.tsx`, `components/SidebarLayout.tsx`
  - Acceptance: Settings shows Health Profile → Conditions link, navigates to new screen, onboarding skips conditions, Dashboard shows conditions from new storage

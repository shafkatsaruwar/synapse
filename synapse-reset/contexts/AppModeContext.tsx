import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { settingsStorage, type AppMode } from "@/lib/storage";

export type ModeAwareScreenKey =
  | "medications"
  | "appointments"
  | "dashboard"
  | "symptoms"
  | "settings"
  | "health-profile";

interface AppModeContextValue {
  appMode: AppMode;
  isSimpleMode: boolean;
  isFullMode: boolean;
  simpleModeFocusAreas: readonly string[];
  setAppMode: (mode: AppMode) => Promise<void>;
}

export const SIMPLE_MODE_FOCUS_AREAS = [
  "Dashboard",
  "Medications",
  "Appointments",
  "Symptoms",
  "Roles",
] as const;

const AppModeContext = createContext<AppModeContextValue | null>(null);

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [appMode, setAppModeState] = useState<AppMode>("full");

  useEffect(() => {
    settingsStorage.get().then((settings) => {
      setAppModeState(settings.appMode ?? "full");
    }).catch(() => {});
  }, []);

  const setAppMode = useCallback(async (mode: AppMode) => {
    setAppModeState(mode);
    const settings = await settingsStorage.get();
    await settingsStorage.save({ ...settings, appMode: mode });
  }, []);

  const value = useMemo(() => ({
    appMode,
    isSimpleMode: appMode === "simple",
    isFullMode: appMode === "full",
    simpleModeFocusAreas: SIMPLE_MODE_FOCUS_AREAS,
    setAppMode,
  }), [appMode, setAppMode]);

  return (
    <AppModeContext.Provider value={value}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext);
  if (!ctx) {
    return {
      appMode: "full",
      isSimpleMode: false,
      isFullMode: true,
      simpleModeFocusAreas: SIMPLE_MODE_FOCUS_AREAS,
      setAppMode: async () => {},
    };
  }
  return ctx;
}

export interface ModeAwareScreenConfig {
  screen: ModeAwareScreenKey;
  appMode: AppMode;
  isSimpleMode: boolean;
  isFullMode: boolean;
  shouldUseLargerButtons: boolean;
  shouldReduceVisibleOptions: boolean;
  shouldFavorStepByStepFlows: boolean;
  shouldHideAdvancedByDefault: boolean;
}

/**
 * Simple Mode foundation only.
 *
 * We are intentionally not redesigning the major screens yet.
 * This hook gives each screen a stable, shared way to know which mode it is in
 * so future Simple Mode branches can be added without duplicating data models.
 *
 * Simple Mode should:
 * - focus on Dashboard, Medications, Appointments, Symptoms, and Roles first
 * - use larger buttons
 * - reduce visible options
 * - avoid overwhelming forms
 * - favor step-by-step flows
 * - show only essential actions first
 * - hide advanced features unless explicitly expanded later
 *
 * Full Mode should:
 * - preserve current detailed behavior
 */
export function useModeAwareScreen(screen: ModeAwareScreenKey): ModeAwareScreenConfig {
  const { appMode, isSimpleMode, isFullMode } = useAppMode();

  return useMemo(
    () => ({
      screen,
      appMode,
      isSimpleMode,
      isFullMode,
      shouldUseLargerButtons: isSimpleMode,
      shouldReduceVisibleOptions: isSimpleMode,
      shouldFavorStepByStepFlows: isSimpleMode,
      shouldHideAdvancedByDefault: isSimpleMode,
    }),
    [appMode, isSimpleMode, isFullMode, screen]
  );
}

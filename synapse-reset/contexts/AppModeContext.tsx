import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { settingsStorage, type AppMode } from "@/lib/storage";

interface AppModeContextValue {
  appMode: AppMode;
  isSimpleMode: boolean;
  setAppMode: (mode: AppMode) => Promise<void>;
}

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
      setAppMode: async () => {},
    };
  }
  return ctx;
}

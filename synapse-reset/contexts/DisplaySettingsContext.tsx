import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { settingsStorage, type UserSettings } from "@/lib/storage";

export type TextSizeSetting = "normal" | "large" | "extra_large";

interface DisplaySettingsContextValue {
  textSize: TextSizeSetting;
  highContrast: boolean;
  textScale: number;
  size: (base: number) => number;
  setTextSize: (size: TextSizeSetting) => Promise<void>;
  setHighContrast: (enabled: boolean) => Promise<void>;
}

const TEXT_SCALE_MAP: Record<TextSizeSetting, number> = {
  normal: 1,
  large: 1.15,
  extra_large: 1.3,
};

const DisplaySettingsContext = createContext<DisplaySettingsContextValue | null>(null);

export function DisplaySettingsProvider({ children }: { children: React.ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSizeSetting>("normal");
  const [highContrast, setHighContrastState] = useState(false);

  useEffect(() => {
    settingsStorage.get().then((settings) => {
      setTextSizeState(settings.textSize ?? "normal");
      setHighContrastState(!!settings.highContrast);
    }).catch(() => {});
  }, []);

  const saveSettingsPatch = useCallback(async (updates: Partial<UserSettings>) => {
    const current = await settingsStorage.get();
    await settingsStorage.save({ ...current, ...updates });
  }, []);

  const setTextSize = useCallback(async (size: TextSizeSetting) => {
    setTextSizeState(size);
    await saveSettingsPatch({ textSize: size });
  }, [saveSettingsPatch]);

  const setHighContrast = useCallback(async (enabled: boolean) => {
    setHighContrastState(enabled);
    await saveSettingsPatch({ highContrast: enabled });
  }, [saveSettingsPatch]);

  const value = useMemo(() => ({
    textSize,
    highContrast,
    textScale: TEXT_SCALE_MAP[textSize],
    size: (base: number) => Math.round(base * TEXT_SCALE_MAP[textSize] * 100) / 100,
    setTextSize,
    setHighContrast,
  }), [highContrast, setHighContrast, setTextSize, textSize]);

  return (
    <DisplaySettingsContext.Provider value={value}>
      {children}
    </DisplaySettingsContext.Provider>
  );
}

export function useDisplaySettings() {
  const context = useContext(DisplaySettingsContext);
  if (!context) {
    return {
      textSize: "normal" as TextSizeSetting,
      highContrast: false,
      textScale: 1,
      size: (base: number) => base,
      setTextSize: async () => {},
      setHighContrast: async () => {},
    };
  }
  return context;
}

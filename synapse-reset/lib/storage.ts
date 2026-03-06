import AsyncStorage from "@react-native-async-storage/async-storage";

/** Batch C minimal: only UserSettings + settingsStorage for auth gate / onboarding. */
export interface UserSettings {
  name: string;
  conditions: string[];
  ramadanMode: boolean;
  sickMode: boolean;
  highContrast?: boolean;
  onboardingCompleted?: true;
  enabledSections?: string[];
}

const SETTINGS_KEY = "fir_settings";

export const settingsStorage = {
  get: async (): Promise<UserSettings> => {
    const defaults: UserSettings = { name: "", conditions: [], ramadanMode: true, sickMode: false };
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch (e) {
      console.warn("AsyncStorage settings get failed", e);
      return defaults;
    }
  },
  save: async (settings: UserSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("AsyncStorage settings save failed", e);
    }
  },
};

import { NativeModules, Platform } from "react-native";

type ScreenTimeFocusModuleShape = {
  requestAuthorization(): Promise<void>;
  pickApps(): Promise<void>;
  startFocus(): Promise<void>;
  stopFocus(): Promise<void>;
};

const nativeModule = NativeModules.ScreenTimeFocusModule as ScreenTimeFocusModuleShape | undefined;

function getModule(): ScreenTimeFocusModuleShape {
  if (Platform.OS !== "ios") {
    throw new Error("Screen Time focus mode is iOS-only.");
  }

  if (!nativeModule) {
    throw new Error("Screen Time focus module is not linked. Run the iOS native build again.");
  }

  return nativeModule;
}

export async function requestAuthorization() {
  await getModule().requestAuthorization();
}

export async function pickApps() {
  await getModule().pickApps();
}

export async function startFocus() {
  await getModule().startFocus();
}

export async function stopFocus() {
  await getModule().stopFocus();
}

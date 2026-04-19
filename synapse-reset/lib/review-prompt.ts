import Constants from "expo-constants";
import { Linking, Platform } from "react-native";

type ReviewPromptResult = "native" | "store" | "unavailable";

function getConfiguredAppStoreId() {
  const extra = Constants.expoConfig?.extra as { appStoreId?: string } | undefined;
  return extra?.appStoreId?.trim() || "";
}

export async function requestSynapseReview(): Promise<ReviewPromptResult> {
  if (Platform.OS === "ios") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const StoreReview = require("expo-store-review");
      if (typeof StoreReview?.isAvailableAsync === "function" && (await StoreReview.isAvailableAsync())) {
        await StoreReview.requestReview();
        return "native";
      }
    } catch {}
  }

  const appStoreId = getConfiguredAppStoreId();
  if (Platform.OS === "ios" && appStoreId) {
    await Linking.openURL(`itms-apps://itunes.apple.com/app/id${appStoreId}?action=write-review`);
    return "store";
  }

  return "unavailable";
}


import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

const PROFILE_IMAGE_DIR = `${FileSystem.documentDirectory ?? ""}profile-images/`;

function getFileExtension(uri: string) {
  const clean = uri.split("?")[0] ?? uri;
  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1) return "jpg";
  return clean.slice(lastDot + 1).toLowerCase() || "jpg";
}

/** Copy a picked gallery image into app documents so it survives cache cleanup. */
export async function persistProfileImage(sourceUri: string, previousUri?: string) {
  if (Platform.OS === "web" || !FileSystem.documentDirectory) {
    return sourceUri;
  }

  await FileSystem.makeDirectoryAsync(PROFILE_IMAGE_DIR, { intermediates: true });

  const extension = getFileExtension(sourceUri);
  const destinationUri = `${PROFILE_IMAGE_DIR}profile-${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });

  if (previousUri?.startsWith(PROFILE_IMAGE_DIR) && previousUri !== destinationUri) {
    const previousInfo = await FileSystem.getInfoAsync(previousUri);
    if (previousInfo.exists) {
      await FileSystem.deleteAsync(previousUri, { idempotent: true });
    }
  }

  return destinationUri;
}

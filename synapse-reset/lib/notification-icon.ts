/**
 * iOS always draws the primary app icon on the left of a notification banner; alternate icons never
 * show there and apps can't change that. The closest honest match is a small thumbnail of the icon
 * you picked, attached to each local notification. The primary icon stays on the left.
 */
import { Asset } from "expo-asset";
import { Platform } from "react-native";
import type * as Notifications from "expo-notifications";
import { APP_ICON_OPTIONS, getCurrentAppIcon } from "@/lib/appearance/app-icons";

type Attachment = NonNullable<Notifications.NotificationContentInput["attachments"]>[number];

let cached: Attachment[] | undefined;
let resolved = false;

async function resolve(): Promise<Attachment[] | undefined> {
  if (Platform.OS !== "ios") return undefined;
  try {
    const id = await getCurrentAppIcon();
    // The default icon already is the primary icon, so there is nothing extra to show.
    if (id === "default") return undefined;
    const option = APP_ICON_OPTIONS.find((o) => o.id === id);
    if (!option) return undefined;
    const asset = Asset.fromModule(option.light as number);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) return undefined;
    return [{ identifier: "synapse-app-icon", url: uri, type: "public.png", typeHint: "public.png", hideThumbnail: false }];
  } catch {
    return undefined;
  }
}

/** Call after the app icon changes. */
export async function refreshNotificationIcon(): Promise<void> {
  cached = await resolve();
  resolved = true;
}

export async function getNotificationIconAttachments(): Promise<Attachment[] | undefined> {
  if (!resolved) await refreshNotificationIcon();
  return cached;
}

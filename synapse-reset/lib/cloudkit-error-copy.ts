/**
 * User-facing copy for CloudKit / iCloud backup failures.
 * Never include backup payloads or medical field values.
 */

export function describeCloudKitAccountStatus(status: string | null | undefined): string {
  switch (status) {
    case "available":
      return "iCloud is available on this device.";
    case "no_account":
      return "Sign in to iCloud in iPhone Settings to use automatic backup.";
    case "restricted":
      return "iCloud is restricted on this device (Screen Time or MDM).";
    case "temporarily_unavailable":
      return "iCloud is temporarily unavailable. Try again shortly.";
    case "could_not_determine":
      return "Synapse couldn’t determine iCloud status right now.";
    case "native_bridge_missing":
      return "This build doesn’t include the iCloud backup module. Use a development or TestFlight build, not Expo Go.";
    case "unsupported_platform":
      return "Automatic iCloud backup is available on iPhone only.";
    case "feature_disabled":
      return "Automatic iCloud backup is not enabled in this app version yet.";
    case "schema_missing":
      return "iCloud backup storage isn’t set up for Synapse Production yet. Your developer must deploy the CloudKit schema.";
    case "error":
      return "Synapse couldn’t reach iCloud. Check your connection and try again.";
    default:
      return status ? `iCloud status: ${status}.` : "iCloud status unknown.";
  }
}

export function describeCloudKitSaveError(message: string | null | undefined): string {
  const text = (message || "").toLowerCase();
  if (text.includes("quota") || text.includes("limit") || text.includes("full")) {
    return "iCloud storage looks full. Free space in iCloud Settings, then try again.";
  }
  if (text.includes("network") || text.includes("offline") || text.includes("internet")) {
    return "Network interrupted before iCloud confirmed the upload. Synapse will retry after the next change.";
  }
  if (
    text.includes("ckerrordomain 12") ||
    text.includes("unknown item") ||
    text.includes("cannot create") ||
    text.includes("not marked for use in production") ||
    text.includes("record type")
  ) {
    return "CloudKit Production schema isn’t ready for Synapse backups yet. Manual file backup still works.";
  }
  if (text.includes("not authenticated") || text.includes("no account")) {
    return "Sign in to iCloud in iPhone Settings, then try again.";
  }
  // Keep generic — never echo payload-related content.
  return "iCloud didn’t confirm this backup. Your information on this phone was not changed.";
}

export function describeCloudKitRestoreError(message: string | null | undefined): string {
  const text = (message || "").toLowerCase();
  if (text.includes("decrypt") || text.includes("passphrase")) {
    return "Synapse couldn’t unlock that backup. Check your recovery passphrase.";
  }
  if (text.includes("network") || text.includes("offline")) {
    return "Network interrupted while downloading the backup. Try again on Wi‑Fi.";
  }
  return "Restore didn’t finish. Existing information on this phone was kept when possible.";
}

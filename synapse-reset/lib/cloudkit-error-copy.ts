/**
 * User-facing copy for known CloudKit backup errors.
 *
 * Pure (no React Native imports) so it can be unit-tested in plain Node.
 */

/**
 * Map a raw CloudKit backup/restore error message to a friendly, non-alarming
 * message for the one case that needs no user action: the private backup record
 * type has not yet been published to the CloudKit *production* schema (CloudKit
 * only auto-creates record types in Development, so a TestFlight/App Store build
 * fails the first save until the schema is deployed to Production).
 *
 * Returns null for every other error so the real, detailed message still shows
 * with its normal title.
 */
export function friendlyCloudKitBackupError(rawMessage?: string | null): { title: string; message: string } | null {
  const msg = (rawMessage ?? "").toLowerCase();
  const schemaNotDeployed =
    msg.includes("production schema") ||
    msg.includes("cannot create new type") ||
    (msg.includes("ckerrordomain 12") && msg.includes("type"));
  if (!schemaNotDeployed) return null;
  return {
    title: "iCloud backup not ready yet",
    message:
      "Private iCloud backup isn’t available yet — its secure iCloud storage still needs to be published. Your data stays saved on this device, and you can use Export All Data as a backup in the meantime. This will start working on its own once setup finishes; nothing is needed from you.",
  };
}

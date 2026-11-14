export const featureFlags = {
  documentScannerEnabled: false,
  /**
   * Master, compile-time kill switch for the private Medication Enforcement Mode.
   * The feature is only active when BOTH this flag AND the persisted per-install
   * setting (`UserSettings.medicationEnforcementEnabled`) are true. This flag is
   * intentionally private — there is no public settings/marketing surface for it.
   */
  medicationEnforcementEnabled: false,
  /**
   * Private CloudKit (iCloud) encrypted backup.
   * Enabled after CloudKit Production UserData schema deploy.
   * Still verify passphrase recovery on a real reinstall / second device before relying on it.
   * See docs/ICLOUD_BACKUP.md. Manual JSON + SIWA Synapse Cloud backup remain available.
   */
  cloudKitBackupEnabled: true,
  /**
   * Remote cloud caregiver linking + Edge Function push (SHIELD-005).
   * Kept off until auth-bound identities replace local_* install IDs (Option A).
   * On-device caregiver mode and Care Connections stay available.
   * See docs/SHIELD_005_CAREGIVER_AUTH_DECISION.md.
   */
  cloudCaregiverPushEnabled: false,
};

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
   * Keep false until BOTH are true:
   * 1) CloudKit Production schema for UserData is deployed (avoids CKErrorDomain 12)
   * 2) Passphrase-wrapped DEK recovery has been verified on a real second device
   * See docs/ICLOUD_BACKUP.md. Manual JSON + SIWA Synapse Cloud backup remain available.
   */
  cloudKitBackupEnabled: false,
};

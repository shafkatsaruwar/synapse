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
   * Private CloudKit (iCloud) backup. Off while the Production schema lacks the
   * UserData record type (CKErrorDomain 12). Local file export/restore remains.
   */
  cloudKitBackupEnabled: false,
};

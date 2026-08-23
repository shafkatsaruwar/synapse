export const featureFlags = {
  documentScannerEnabled: false,
  /**
   * Master, compile-time kill switch for the private Medication Enforcement Mode.
   * The feature is only active when BOTH this flag AND the persisted per-install
   * setting (`UserSettings.medicationEnforcementEnabled`) are true. This flag is
   * intentionally private — there is no public settings/marketing surface for it.
   */
  medicationEnforcementEnabled: false,
};

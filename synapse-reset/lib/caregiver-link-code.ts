/** Pure helpers for caregiver link-code entry (no native deps). */

export const CAREGIVER_LINK_CODE_LENGTH = 6;

/** Normalize user-entered caregiver link codes (case/whitespace/punctuation). */
export function normalizeCaregiverLinkCode(codeInput: string): string {
  return codeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidCaregiverLinkCode(codeInput: string): boolean {
  return normalizeCaregiverLinkCode(codeInput).length === CAREGIVER_LINK_CODE_LENGTH;
}

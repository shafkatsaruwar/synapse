/**
 * SHIELD-005 Option B — cloud caregiver push / remote linking kill switch.
 * On-device caregiver mode and Care Connections are unaffected.
 */
import { featureFlags } from "../constants/feature-flags";

export const CLOUD_CAREGIVER_DISABLED_MESSAGE =
  "Cloud caregiver linking is temporarily unavailable. Use on-device caregiver mode or Care Connections.";

export function isCloudCaregiverPushEnabled(): boolean {
  return featureFlags.cloudCaregiverPushEnabled === true;
}

export function cloudCaregiverDisabledError(): Error {
  return new Error(CLOUD_CAREGIVER_DISABLED_MESSAGE);
}

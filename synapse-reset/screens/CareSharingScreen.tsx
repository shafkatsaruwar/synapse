import React from "react";
import SettingsScreen, { type SettingsScreenVariant } from "@/screens/SettingsScreen";

type CareSharingScreenProps = Omit<React.ComponentProps<typeof SettingsScreen>, "variant"> & {
  variant?: Extract<SettingsScreenVariant, "care">;
};

/** Care & Sharing surface — roles, caregiver linking, care team shortcuts. */
export default function CareSharingScreen(props: CareSharingScreenProps) {
  return <SettingsScreen {...props} variant="care" />;
}

import React from "react";
import SettingsScreen, { type SettingsScreenVariant } from "@/screens/SettingsScreen";

type CareSharingScreenProps = Omit<React.ComponentProps<typeof SettingsScreen>, "variant"> & {
  variant?: Extract<SettingsScreenVariant, "care">;
};

/** Care & Sharing surface: roles, people you care for, Care Connections, and privacy notes. */
export default function CareSharingScreen(props: CareSharingScreenProps) {
  return <SettingsScreen {...props} variant="care" />;
}

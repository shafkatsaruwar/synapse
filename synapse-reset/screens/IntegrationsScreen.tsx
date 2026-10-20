import React from "react";
import SettingsScreen, { type SettingsScreenVariant } from "@/screens/SettingsScreen";

type IntegrationsScreenProps = Omit<React.ComponentProps<typeof SettingsScreen>, "variant"> & {
  variant?: Extract<SettingsScreenVariant, "integrations">;
};

/** Integrations surface — Apple Health and optional assistant sync. */
export default function IntegrationsScreen(props: IntegrationsScreenProps) {
  return <SettingsScreen {...props} variant="integrations" />;
}

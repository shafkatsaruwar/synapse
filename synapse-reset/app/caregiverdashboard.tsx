import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function CaregiverDashboardDeepLinkRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const resolvedMode = Array.isArray(mode) ? mode[0] : mode;

  return (
    <Redirect
      href={{
        pathname: "/",
        params: {
          widgetTarget: "caregiverdashboard",
          ...(resolvedMode ? { mode: resolvedMode } : {}),
        },
      }}
    />
  );
}

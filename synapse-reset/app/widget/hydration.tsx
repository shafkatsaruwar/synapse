import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function WidgetHydrationRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const resolvedMode = Array.isArray(mode) ? mode[0] : mode;
  return <Redirect href={{ pathname: "/", params: { widgetTarget: "hydration", ...(resolvedMode ? { mode: resolvedMode } : {}) } }} />;
}

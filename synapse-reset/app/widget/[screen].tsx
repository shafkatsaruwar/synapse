import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function WidgetRouteScreen() {
  const { screen } = useLocalSearchParams<{ screen?: string | string[] }>();
  const target = Array.isArray(screen) ? screen[0] : screen;
  const resolvedTarget = target === "appointments" ? "appointments" : "medications";

  return <Redirect href={{ pathname: "/", params: { widgetTarget: resolvedTarget } }} />;
}

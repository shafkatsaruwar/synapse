import React from "react";
import { Redirect } from "expo-router";

export default function WidgetHydrationRoute() {
  return <Redirect href={{ pathname: "/", params: { widgetTarget: "hydration" } }} />;
}

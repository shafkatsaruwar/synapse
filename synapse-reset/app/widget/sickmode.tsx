import React from "react";
import { Redirect } from "expo-router";

export default function WidgetSickModeRoute() {
  return <Redirect href={{ pathname: "/", params: { widgetTarget: "sickmode" } }} />;
}

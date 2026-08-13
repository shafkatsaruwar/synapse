import React from "react";
import { Redirect } from "expo-router";

export default function WidgetReportsRoute() {
  return <Redirect href={{ pathname: "/", params: { widgetTarget: "reports" } }} />;
}

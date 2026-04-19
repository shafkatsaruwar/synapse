import React from "react";
import { Redirect } from "expo-router";

export default function WidgetMedicationsRoute() {
  return <Redirect href={{ pathname: "/", params: { widgetTarget: "medications" } }} />;
}

import React from "react";
import { Redirect } from "expo-router";

export default function WidgetMentalHealthRoute() {
  return <Redirect href={{ pathname: "/", params: { widgetTarget: "mentalhealth" } }} />;
}

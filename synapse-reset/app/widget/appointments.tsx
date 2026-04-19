import React from "react";
import { Redirect } from "expo-router";

export default function WidgetAppointmentsRoute() {
  return <Redirect href={{ pathname: "/", params: { widgetTarget: "appointments" } }} />;
}

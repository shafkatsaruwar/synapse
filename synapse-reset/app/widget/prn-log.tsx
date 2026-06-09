import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function WidgetPrnLogRoute() {
  const { medId } = useLocalSearchParams<{ medId?: string | string[] }>();
  const resolvedMedId = Array.isArray(medId) ? medId[0] : medId;

  return <Redirect href={{ pathname: "/", params: { widgetTarget: "prnlog", medId: resolvedMedId } }} />;
}

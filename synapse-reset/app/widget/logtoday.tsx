import { Redirect } from "expo-router";

export default function WidgetLogTodayRoute() {
  return <Redirect href={{ pathname: "/", params: { widgetTarget: "daily-log" } }} />;
}

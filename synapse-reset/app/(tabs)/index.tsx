import React from "react";
import { View } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";
import AuthStub from "@/screens/AuthStub";
import DashboardStub from "@/screens/DashboardStub";

/** Batch C: auth gate — show AuthStub when not signed in, Dashboard when signed in. */
export default function IndexScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: Colors.dark.background }} />;
  }
  if (!user) {
    return <AuthStub />;
  }
  return <DashboardStub />;
}

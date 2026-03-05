import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { queryClient } from "@/lib/query-client";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import * as SplashScreen from "expo-splash-screen";

// Keep native splash visible until app is ready; we must call hideAsync() when ready so app content is visible (do not remove).
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <Stack screenOptions={{ headerShown: false }} />
        </ErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setReady(true);
      // Required: hide native splash so dashboard/app content is visible (Expo Go + TestFlight).
      SplashScreen.hideAsync().catch(() => {});
    }, 100);
    return () => clearTimeout(t);
  }, []);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: "#FDF1E5" }} />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1 }}>
            <AppContent />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
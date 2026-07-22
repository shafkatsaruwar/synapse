import "@/lib/supabase-web-env";
import React, { useEffect, useState } from "react";
import { AppState, View, Linking, Platform } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import * as FileSystem from "expo-file-system/legacy";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import KeyboardDoneBar from "@/components/KeyboardDoneBar";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppModeProvider } from "@/contexts/AppModeContext";
import { DisplaySettingsProvider } from "@/contexts/DisplaySettingsContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { queryClient } from "@/lib/query-client";
import {
  setNotificationHandler,
  setupMedicationCategory,
  addNotificationResponseListener,
  updateAppIconBadgeCount,
} from "@/lib/notification-manager";
import { syncWidgetSnapshot } from "@/lib/widget-sync";
import { parseICS } from "@/lib/ics-parser";
import { fireICSImport } from "@/lib/ics-import-event";
import { installCloudKitAutoSync } from "@/lib/cloudkit-backup";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setNotificationHandler();
    setupMedicationCategory();
    const remove = addNotificationResponseListener(() => {}, () => {});
    updateAppIconBadgeCount().catch(() => {});
    syncWidgetSnapshot().catch(() => {});
    return remove;
  }, []);

  useEffect(() => installCloudKitAutoSync(), []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") updateAppIconBadgeCount().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    async function handleUrl(url: string) {
      if (!url.startsWith("file://") || !url.toLowerCase().endsWith(".ics")) return;
      try {
        const content = await FileSystem.readAsStringAsync(url);
        const parsed = parseICS(content);
        if (parsed) fireICSImport(parsed);
      } catch {
        // Silently ignore unreadable files
      }
    }

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); }).catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  if (!ready) {
    return (
      <View
        style={{ flex: 1, backgroundColor: "#F5F1EA" }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <DisplaySettingsProvider>
              <ThemeProvider>
                <AppModeProvider>
                  <RoleProvider>
                    <AuthProvider>
                      <Stack screenOptions={{ headerShown: false }} />
                      <KeyboardDoneBar />
                    </AuthProvider>
                  </RoleProvider>
                </AppModeProvider>
              </ThemeProvider>
            </DisplaySettingsProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

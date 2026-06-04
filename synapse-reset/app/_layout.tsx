import "react-native-gesture-handler";
import "@/lib/supabase-web-env";
import React, { useEffect, useState } from "react";
import { View, Linking, Platform } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { File } from "expo-file-system";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import KeyboardDoneBar from "@/components/KeyboardDoneBar";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppModeProvider } from "@/contexts/AppModeContext";
import { DisplaySettingsProvider } from "@/contexts/DisplaySettingsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { queryClient } from "@/lib/query-client";
import {
  setNotificationHandler,
  setupMedicationCategory,
  addNotificationResponseListener,
} from "@/lib/notification-manager";
import { syncWidgetSnapshot } from "@/lib/widget-sync";
import { parseICS } from "@/lib/ics-parser";
import { fireICSImport } from "@/lib/ics-import-event";

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
    syncWidgetSnapshot().catch(() => {});
    return remove;
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    async function handleUrl(url: string) {
      if (!url.startsWith("file://") || !url.toLowerCase().endsWith(".ics")) return;
      try {
        const file = new File(url);
        const content = await file.text();
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
        style={{ flex: 1, backgroundColor: "#FDF1E5" }}
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
                  <AuthProvider>
                    <Stack screenOptions={{ headerShown: false }} />
                    <KeyboardDoneBar />
                  </AuthProvider>
                </AppModeProvider>
              </ThemeProvider>
            </DisplaySettingsProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

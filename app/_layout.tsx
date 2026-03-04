/**
 * MINIMAL BOOT TEST: Isolate TestFlight startup crash.
 * No Supabase, no AuthProvider, no AsyncStorage/SecureStore, no API clients.
 * No providers — only React Native View + Text so nothing native runs before React mounts.
 */
import React from "react";
import { View, Text } from "react-native";

export default function RootLayout() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Synapse Boot Test</Text>
    </View>
  );
}

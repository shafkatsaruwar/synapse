import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { View, Text } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Inter_400Regular } from "@expo-google-fonts/inter";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular });

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    const id = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 50);
    return () => clearTimeout(id);
  }, [fontsLoaded]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Synapse Boot Test</Text>
    </View>
  );
}

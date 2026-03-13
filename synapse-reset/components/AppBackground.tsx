import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, type ThemeId } from "@/contexts/ThemeContext";

interface AppBackgroundProps {
  children: React.ReactNode;
}

export default function AppBackground({ children }: AppBackgroundProps) {
  const { themeId } = useTheme();

  if (themeId === "light") {
    return (
      <LinearGradient
        colors={["#C9D8F6", "#BFD2F0", "#B7E3D9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {children}
      </LinearGradient>
    );
  }

  const backgroundColor =
    themeId === "dark"
      ? "#000000"
      : "#E8D7C3";

  return (
    <View style={[styles.solid, { backgroundColor }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  solid: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});


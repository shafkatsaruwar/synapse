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
      <View style={styles.root}>
        <LinearGradient
          colors={["#C9D8F6", "#BFD2F0", "#B7E3D9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.backgroundLayer}
        />
        {children}
      </View>
    );
  }

  const backgroundColor =
    themeId === "dark"
      ? "#000000"
      : "#E8D7C3";

  return (
    <View style={styles.root}>
      <View style={[styles.backgroundLayer, { backgroundColor }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  backgroundLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});


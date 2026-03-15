import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";

interface GlassViewProps {
  children: React.ReactNode;
  intensity?: number;
  tint?: "light" | "dark" | "default";
  style?: object;
}

/**
 * Glass-style container using BlurView on native; translucent fallback on web.
 * Use for cards and floating bars (thinMaterial / ultraThinMaterial style).
 */
export default function GlassView({
  children,
  intensity = 40,
  tint = "light",
  style,
}: GlassViewProps) {
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          styles.fallback,
          { backgroundColor: "rgba(255,255,255,0.75)" },
          style,
        ]}
      >
        {children}
      </View>
    );
  }
  return (
    <BlurView intensity={intensity} tint={tint} style={[styles.blur, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    overflow: "hidden",
  },
  fallback: {
    overflow: "hidden",
  },
});

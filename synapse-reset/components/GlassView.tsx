import React from "react";
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { raised } from "@/constants/raised";

export type GlassVariant = "card" | "floating" | "sheet" | "nav" | "hero";

interface GlassViewProps {
  children?: React.ReactNode;
  intensity?: number;
  tint?: "light" | "dark" | "default";
  variant?: GlassVariant;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Glass-style container using BlurView on native; translucent fallback on web.
 * Use for cards and floating bars (thinMaterial / ultraThinMaterial style).
 */
export default function GlassView({
  children,
  intensity,
  tint = "light",
  variant = "card",
  style,
  contentStyle,
}: GlassViewProps) {
  const variantStyle = styles[variant];
  const resolvedIntensity = intensity ?? GLASS_INTENSITY[variant];
  const content = contentStyle ? <View style={contentStyle}>{children}</View> : children;

  if (Platform.OS === "web") {
    return (
      <View
        style={[
          styles.fallback,
          variantStyle,
          style,
        ]}
      >
        {content}
      </View>
    );
  }
  return (
    <BlurView intensity={resolvedIntensity} tint={tint} style={[styles.blur, variantStyle, style]}>
      <View pointerEvents="none" style={styles.cornerGlow} />
      {content}
      <View pointerEvents="none" style={styles.edgeShine} />
    </BlurView>
  );
}

export const GLASS_INTENSITY: Record<GlassVariant, number> = {
  card: 84,
  floating: 90,
  sheet: 92,
  nav: 88,
  hero: 94,
};

export const glassPressedStyle = {
  opacity: 0.92,
  transform: [{ scale: 0.985 }],
} as const;

const styles = StyleSheet.create({
  blur: {
    overflow: "hidden",
  },
  fallback: {
    overflow: "hidden",
    backdropFilter: Platform.OS === "web" ? "blur(24px)" : undefined,
  } as ViewStyle,
  edgeShine: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 0.5,
    borderColor: "rgba(255,255,255,0.94)",
    opacity: 0.92,
  },
  cornerGlow: {
    position: "absolute",
    top: -60,
    left: -40,
    width: 160,
    height: 120,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.42)",
    transform: [{ rotate: "-16deg" }],
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.34)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.86)",
    ...raised("md", "#7E7268"),
  },
  floating: {
    backgroundColor: "rgba(255,255,255,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    ...raised("lg", "#74685F"),
  },
  sheet: {
    backgroundColor: "rgba(255,255,255,0.48)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    ...raised("lg", "#6F645E"),
  },
  nav: {
    backgroundColor: "rgba(255,255,255,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
    ...raised("lg", "#6F766C"),
  },
  hero: {
    backgroundColor: "rgba(255,255,255,0.36)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    ...raised("lg", "#7E7268"),
  },
});

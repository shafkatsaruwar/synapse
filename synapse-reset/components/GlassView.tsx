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
 * Nav skips the white edge-shine / corner bloom so the tab bar doesn’t ring
 * against Soft Evergreen’s single flat background.
 *
 * When `tint="dark"`, surfaces use charcoal frost instead of white — otherwise
 * Dark / Evergreen-dark themes keep looking light.
 */
export default function GlassView({
  children,
  intensity,
  tint = "light",
  variant = "card",
  style,
  contentStyle,
}: GlassViewProps) {
  const isDarkTint = tint === "dark";
  const variantStyle = isDarkTint ? darkStyles[variant] : styles[variant];
  const resolvedIntensity = intensity ?? GLASS_INTENSITY[variant];
  const content = contentStyle ? <View style={contentStyle}>{children}</View> : children;
  const isNav = variant === "nav";

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
      {!isNav ? (
        <View pointerEvents="none" style={[styles.cornerGlow, isDarkTint && styles.cornerGlowDark]} />
      ) : null}
      {content}
      {!isNav ? (
        <View pointerEvents="none" style={[styles.edgeShine, isDarkTint && styles.edgeShineDark]} />
      ) : null}
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
  edgeShineDark: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 0.5,
    borderColor: "rgba(255,255,255,0.28)",
    opacity: 0.38,
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
  cornerGlowDark: {
    top: -82,
    left: -66,
    width: 140,
    height: 104,
    backgroundColor: "rgba(255,255,255,0.10)",
    opacity: 0.42,
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
    // Soft frosted pill — subtle gray hairline, no bright white chrome ring.
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(32,37,42,0.08)",
    shadowColor: "#20252A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === "android" ? undefined : 0.06,
    shadowRadius: Platform.OS === "android" ? undefined : 10,
    elevation: 3,
  },
  hero: {
    backgroundColor: "rgba(255,255,255,0.36)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    ...raised("lg", "#7E7268"),
  },
});

const darkStyles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(28,24,26,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    ...raised("md", "#000000"),
  },
  floating: {
    backgroundColor: "rgba(28,24,26,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    ...raised("lg", "#000000"),
  },
  sheet: {
    backgroundColor: "rgba(22,18,20,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    ...raised("lg", "#000000"),
  },
  nav: {
    backgroundColor: "rgba(28,24,26,0.88)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === "android" ? undefined : 0.35,
    shadowRadius: Platform.OS === "android" ? undefined : 12,
    elevation: 3,
  },
  hero: {
    backgroundColor: "rgba(28,24,26,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    ...raised("lg", "#000000"),
  },
});

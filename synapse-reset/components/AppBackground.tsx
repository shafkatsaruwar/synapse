import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { isDarkAppearance, isEvergreenTheme, useTheme } from "@/contexts/ThemeContext";

interface AppBackgroundProps {
  children: React.ReactNode;
}

export default function AppBackground({ children }: AppBackgroundProps) {
  const { themeId, colors } = useTheme();

  // Soft Evergreen: flat cool off-white / charcoal — no beige glass overlays.
  if (isEvergreenTheme(themeId)) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  }

  if (themeId === "light") {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={["#F5F1EA", "#ECEDE5", "#E0EAE0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.backgroundLayer}
        />
        <LinearGradient
          colors={["rgba(255,255,255,0.62)", "rgba(255,255,255,0)"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.prismLayer, styles.prismTop]}
        />
        <LinearGradient
          colors={["rgba(222,201,190,0.3)", "rgba(166,203,184,0.12)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.prismLayer, styles.prismMiddle]}
        />
        <View style={[styles.bloom, styles.bloomTop]} />
        <View style={[styles.bloom, styles.bloomBottom]} />
        <View style={[styles.bloom, styles.bloomMint]} />
        {children}
      </View>
    );
  }

  const backgroundColor = isDarkAppearance(themeId) ? "#0D0B0C" : "#F5ECE2";

  return (
    <View style={styles.root}>
      {themeId === "dark" ? (
        <>
          <LinearGradient
            colors={["#171011", "#0D0B0C", "#0A1512"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backgroundLayer}
          />
          <View style={[styles.bloom, styles.bloomDarkTop]} />
        </>
      ) : (
        <>
          <LinearGradient
            colors={[backgroundColor, "#EFE1DC", "#E2E9DD"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backgroundLayer}
          />
          <View style={[styles.bloom, styles.bloomCalm]} />
        </>
      )}
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
    ...StyleSheet.absoluteFillObject,
  },
  prismLayer: {
    position: "absolute",
    width: "140%",
    height: "70%",
  },
  prismTop: {
    top: -80,
    left: -60,
  },
  prismMiddle: {
    top: "28%",
    left: -40,
  },
  bloom: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.35,
  },
  bloomTop: {
    top: -60,
    right: -40,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  bloomBottom: {
    bottom: 80,
    left: -80,
    backgroundColor: "rgba(222,201,190,0.4)",
  },
  bloomMint: {
    bottom: "18%",
    right: -60,
    backgroundColor: "rgba(166,203,184,0.28)",
  },
  bloomDarkTop: {
    top: -40,
    right: -20,
    backgroundColor: "rgba(217,74,92,0.12)",
  },
  bloomCalm: {
    top: 40,
    right: -40,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});

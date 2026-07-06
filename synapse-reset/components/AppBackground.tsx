import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";

interface AppBackgroundProps {
  children: React.ReactNode;
}

export default function AppBackground({ children }: AppBackgroundProps) {
  const { themeId } = useTheme();

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

  const backgroundColor =
    themeId === "dark"
      ? "#0D0B0C"
      : "#F5ECE2";

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
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  bloom: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.42,
  },
  prismLayer: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 260,
  },
  prismTop: {
    top: -180,
    right: -180,
    transform: [{ rotate: "18deg" }],
  },
  prismMiddle: {
    top: 250,
    left: -220,
    transform: [{ rotate: "-14deg" }],
  },
  bloomTop: {
    top: -90,
    right: -80,
    backgroundColor: "rgba(255,255,255,0.62)",
  },
  bloomBottom: {
    bottom: -110,
    left: -80,
    backgroundColor: "rgba(156,204,180,0.26)",
  },
  bloomMint: {
    top: 260,
    left: -120,
    backgroundColor: "rgba(255,255,255,0.34)",
  },
  bloomCalm: {
    bottom: -80,
    right: -90,
    backgroundColor: "rgba(198,218,199,0.32)",
  },
  bloomDarkTop: {
    top: -100,
    right: -80,
    backgroundColor: "rgba(217,74,92,0.16)",
  },
});

import React from "react";
import { Image, StatusBar, View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  isBlueTheme,
  isDarkAppearance,
  isEvergreenTheme,
  useTheme,
} from "@/contexts/ThemeContext";
import { getWallpaper } from "@/lib/appearance/wallpapers";

interface AppBackgroundProps {
  children: React.ReactNode;
}

export default function AppBackground({ children }: AppBackgroundProps) {
  const { themeId, colors, appearance, draftAppearance, reduceMotion } = useTheme();
  const active = draftAppearance ?? appearance;
  const wallpaper = getWallpaper(active.wallpaper);
  const brightness = active.wallpaperBrightness;
  const darkUi = isDarkAppearance(themeId);

  // Soft Evergreen / Light / Blue: single atmospheric field (+ optional wallpaper wash).
  if (isEvergreenTheme(themeId) || themeId === "light" || isBlueTheme(themeId)) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={darkUi ? "light-content" : "dark-content"} />
        {wallpaper && wallpaper.colors.length >= 2 && !reduceMotion ? (
          <LinearGradient
            colors={wallpaper.colors as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.backgroundLayer, { opacity: brightness * 0.55 }]}
          />
        ) : null}
        {active.wallpaper === "custom" && active.customWallpaperUri ? (
          <Image
            source={{ uri: active.customWallpaperUri }}
            style={[styles.backgroundLayer, { opacity: brightness * 0.35 }]}
            resizeMode="cover"
            accessibilityElementsHidden
          />
        ) : null}
        {children}
      </View>
    );
  }

  const backgroundColor = darkUi ? "#0D0B0C" : "#F5ECE2";

  return (
    <View style={styles.root}>
      <StatusBar barStyle={darkUi ? "light-content" : "dark-content"} />
      {themeId === "dark" || themeId === "evergreenDark" ? (
        <>
          <LinearGradient
            colors={["#171011", "#0D0B0C", "#0A1512"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backgroundLayer}
          />
          {wallpaper && wallpaper.colors.length >= 2 ? (
            <LinearGradient
              colors={wallpaper.colors as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.backgroundLayer, { opacity: brightness * 0.22 }]}
            />
          ) : null}
          <View style={[styles.bloom, styles.bloomDarkTop]} />
        </>
      ) : (
        <>
          <LinearGradient
            colors={
              wallpaper && wallpaper.colors.length >= 2
                ? (wallpaper.colors as [string, string, ...string[]])
                : [backgroundColor, "#EFE1DC", "#E2E9DD"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.backgroundLayer, wallpaper ? { opacity: brightness } : null]}
          />
          {!wallpaper ? <View style={[styles.bloom, styles.bloomCalm]} /> : null}
          {active.wallpaper === "custom" && active.customWallpaperUri ? (
            <Image
              source={{ uri: active.customWallpaperUri }}
              style={[styles.backgroundLayer, { opacity: brightness * 0.3 }]}
              resizeMode="cover"
              accessibilityElementsHidden
            />
          ) : null}
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
  bloom: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.35,
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

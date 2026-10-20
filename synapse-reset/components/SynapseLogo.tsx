import React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";
import { isDarkAppearance, useTheme } from "@/contexts/ThemeContext";

const logoLight = require("../assets/images/synapse-logo-light.png");
const logoDark = require("../assets/images/synapse-logo-dark.png");

export type SynapseLogoProps = {
  /** Display size in points (square). */
  size?: number;
  style?: StyleProp<ImageStyle>;
  /** Force light/dark asset; defaults to current theme appearance. */
  appearance?: "light" | "dark";
  accessibilityLabel?: string;
};

/**
 * Theme-aware Synapse mark (light/dark app icons from the brand kit).
 */
export default function SynapseLogo({
  size = 40,
  style,
  appearance,
  accessibilityLabel = "Synapse",
}: SynapseLogoProps) {
  const { themeId } = useTheme();
  const useDark = appearance ? appearance === "dark" : isDarkAppearance(themeId);

  return (
    <Image
      source={useDark ? logoDark : logoLight}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    />
  );
}

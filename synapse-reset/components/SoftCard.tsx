import React from "react";
import { View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { softCardSurface, type SoftCardTone } from "@/constants/soft-card";
import { isDarkAppearance, useTheme } from "@/contexts/ThemeContext";

type SoftCardProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
  /** Override automatic light/dark elevation tone. */
  tone?: SoftCardTone;
  borderRadius?: number;
  children?: React.ReactNode;
};

/**
 * Reusable Soft Evergreen dashboard card shell — white/charcoal fill,
 * 1px border, soft ambient shadow. Layout/content stay with the caller.
 */
export default function SoftCard({
  style,
  tone: toneProp,
  borderRadius = 22,
  children,
  ...rest
}: SoftCardProps) {
  const { colors: C, themeId } = useTheme();
  const tone: SoftCardTone = toneProp ?? (isDarkAppearance(themeId) ? "dark" : "light");
  return (
    <View
      {...rest}
      style={[
        softCardSurface({
          tone,
          backgroundColor: C.surface,
          borderRadius,
        }),
        style,
      ]}
    >
      {children}
    </View>
  );
}

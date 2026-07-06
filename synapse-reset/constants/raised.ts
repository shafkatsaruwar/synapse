import { Platform, type ViewStyle } from "react-native";

type RaisedLevel = "sm" | "md" | "lg";

const RAISED_LEVELS: Record<RaisedLevel, Pick<ViewStyle, "shadowOffset" | "shadowOpacity" | "shadowRadius" | "elevation">> = {
  sm: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 7,
  },
  md: {
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.19,
    shadowRadius: 30,
    elevation: 12,
  },
  lg: {
    shadowOffset: { width: 0, height: 26 },
    shadowOpacity: 0.24,
    shadowRadius: 46,
    elevation: 18,
  },
};

export function raised(level: RaisedLevel = "md", color = "#7A6A62"): ViewStyle {
  const depth = RAISED_LEVELS[level];
  return {
    shadowColor: color,
    shadowOffset: depth.shadowOffset,
    shadowOpacity: Platform.OS === "android" ? undefined : depth.shadowOpacity,
    shadowRadius: Platform.OS === "android" ? undefined : depth.shadowRadius,
    elevation: depth.elevation,
  };
}

// Design system tokens for consistent UI across the app
import { Colors } from "@react-native/design-tokens";

export const UITokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: "700", lineHeight: 32 },
    h2: { fontSize: 20, fontWeight: "600", lineHeight: 24 },
    h3: { fontSize: 16, fontWeight: "600", lineHeight: 20 },
    body: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: "400", lineHeight: 16 },
    small: { fontSize: 11, fontWeight: "400", lineHeight: 14 },
  },
  touchTarget: 48, // Minimum accessibility touch target
  minButton: 48, // Minimum button height
  spacing16: 16, // Standard section spacing
  spacing24: 24, // Large section spacing
};

export const StatusColors = {
  success: "#10B981", // Green
  warning: "#F59E0B", // Amber
  danger: "#EF4444",  // Red
  info: "#3B82F6",    // Blue
  neutral: "#6B7280", // Gray
};

export const DataVizColors = {
  energy: "#F59E0B",
  mood: "#EC4899",
  sleep: "#6366F1",
  hydration: "#06B6D4",
  adherence: "#10B981",
  heart: "#EF4444",
  steps: "#8B5CF6",
  temperature: "#F97316",
};

export const GradientColors = {
  success: ["#10B981", "#059669"],
  warning: ["#F59E0B", "#D97706"],
  danger: ["#EF4444", "#DC2626"],
  info: ["#3B82F6", "#1D4ED8"],
  purple: ["#A855F7", "#7C3AED"],
  pink: ["#EC4899", "#DB2777"],
};

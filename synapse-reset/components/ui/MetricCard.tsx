import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { UITokens, StatusColors } from "@/constants/ui-design";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  status?: "good" | "warning" | "poor";
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function MetricCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  status,
  icon,
  style,
}: MetricCardProps) {
  const { colors } = useTheme();
  const dynamicStyles = makeStyles(colors);
  const getStatusColor = () => {
    switch (status) {
      case "good":
        return StatusColors.success;
      case "warning":
        return StatusColors.warning;
      case "poor":
        return StatusColors.danger;
      default:
        return StatusColors.info;
    }
  };

  const getTrendIcon = () => {
    if (trend === "up") return "↑";
    if (trend === "down") return "↓";
    return "";
  };

  const statusColor = getStatusColor();

  return (
    <View style={[dynamicStyles.container, style]}>
      {icon && <View style={dynamicStyles.icon}>{icon}</View>}
      <Text style={dynamicStyles.label}>{label}</Text>
      <View style={dynamicStyles.valueContainer}>
        <Text style={[dynamicStyles.value, { color: statusColor }]}>
          {value}
        </Text>
        {unit && <Text style={dynamicStyles.unit}>{unit}</Text>}
      </View>
      {trendValue && (
        <View style={dynamicStyles.trendContainer}>
          <Text style={[dynamicStyles.trend, { color: statusColor }]}>
            {getTrendIcon()} {trendValue}
          </Text>
        </View>
      )}
      {status && (
        <View
          style={[
            dynamicStyles.statusBadge,
            { backgroundColor: statusColor + "20" },
          ]}
        >
          <Text
            style={[
              dynamicStyles.statusText,
              { color: statusColor },
            ]}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.lg,
    minHeight: 140,
    justifyContent: "space-between",
  },
  icon: {
    marginBottom: UITokens.spacing.md,
  },
  label: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
    fontWeight: "500",
    textTransform: "uppercase",
    marginBottom: UITokens.spacing.sm,
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: UITokens.spacing.md,
  },
  value: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
  },
  unit: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
    marginLeft: UITokens.spacing.xs,
  },
  trendContainer: {
    marginBottom: UITokens.spacing.sm,
  },
  trend: {
    fontSize: UITokens.typography.caption.fontSize,
    fontWeight: "600",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: UITokens.spacing.sm,
    paddingVertical: UITokens.spacing.xs,
    borderRadius: UITokens.borderRadius.full,
  },
  statusText: {
    fontSize: UITokens.typography.caption.fontSize,
    fontWeight: "600",
  },
});

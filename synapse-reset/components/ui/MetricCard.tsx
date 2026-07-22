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
    padding: UITokens.spacing.md,
    minHeight: 100,
    justifyContent: "space-between",
  },
  icon: {
    marginBottom: UITokens.spacing.xs,
  },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "500",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: UITokens.spacing.sm,
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
  },
  unit: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: UITokens.spacing.xs,
  },
  trendContainer: {
    marginBottom: UITokens.spacing.xs,
  },
  trend: {
    fontSize: 10,
    fontWeight: "600",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: UITokens.borderRadius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
});

import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
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
    <View style={[styles.container, style]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueContainer}>
        <Text style={[styles.value, { color: statusColor }]}>
          {value}
        </Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
      {trendValue && (
        <View style={styles.trendContainer}>
          <Text style={[styles.trend, { color: statusColor }]}>
            {getTrendIcon()} {trendValue}
          </Text>
        </View>
      )}
      {status && (
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusColor + "20" },
          ]}
        >
          <Text
            style={[
              styles.statusText,
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1F2937",
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
    color: "#9CA3AF",
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
  },
  unit: {
    fontSize: UITokens.typography.caption.fontSize,
    color: "#9CA3AF",
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

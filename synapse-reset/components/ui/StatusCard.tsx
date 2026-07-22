import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { UITokens, StatusColors } from "@/constants/ui-design";

interface StatusCardProps {
  icon: React.ReactNode;
  title: string;
  value?: string;
  subtitle?: string;
  status?: "success" | "warning" | "danger" | "info";
  style?: ViewStyle;
  onPress?: () => void;
}

export function StatusCard({
  icon,
  title,
  value,
  subtitle,
  status = "info",
  style,
  onPress,
}: StatusCardProps) {
  const statusColor = StatusColors[status] || StatusColors.info;

  return (
    <View
      style={[
        styles.container,
        { borderLeftColor: statusColor },
        style,
      ]}
      onTouchEnd={onPress}
    >
      <View style={styles.iconContainer}>
        {icon}
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {value && (
          <Text style={[styles.value, { color: statusColor }]}>
            {value}
          </Text>
        )}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#1F2937",
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.md,
    marginVertical: UITokens.spacing.sm,
    borderLeftWidth: 4,
    minHeight: UITokens.touchTarget,
    justifyContent: "center",
  },
  iconContainer: {
    marginRight: UITokens.spacing.md,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "500",
    color: "#F3F4F6",
    marginBottom: UITokens.spacing.xs,
  },
  value: {
    fontSize: UITokens.typography.h3.fontSize,
    fontWeight: "600",
    marginBottom: UITokens.spacing.xs,
  },
  subtitle: {
    fontSize: UITokens.typography.caption.fontSize,
    color: "#9CA3AF",
  },
});

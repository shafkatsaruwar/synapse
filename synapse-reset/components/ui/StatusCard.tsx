import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
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
  const { colors } = useTheme();
  const dynamicStyles = makeStyles(colors);
  const statusColor = StatusColors[status] || StatusColors.info;

  return (
    <View
      style={[
        dynamicStyles.container,
        { borderLeftColor: statusColor },
        style,
      ]}
      onTouchEnd={onPress}
    >
      <View style={dynamicStyles.iconContainer}>
        {icon}
      </View>
      <View style={dynamicStyles.content}>
        <Text style={dynamicStyles.title}>{title}</Text>
        {value && (
          <Text style={[dynamicStyles.value, { color: statusColor }]}>
            {value}
          </Text>
        )}
        {subtitle && <Text style={dynamicStyles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
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
    color: colors.text,
    marginBottom: UITokens.spacing.xs,
  },
  value: {
    fontSize: UITokens.typography.h3.fontSize,
    fontWeight: "600",
    marginBottom: UITokens.spacing.xs,
    color: colors.text,
  },
  subtitle: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
  },
});

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle, Animated } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { UITokens, StatusColors } from "@/constants/ui-design";

interface MedicationCardProps {
  emoji: string;
  name: string;
  dosage: string;
  nextDoseIn?: string;
  adherencePercent?: number;
  supplyStatus?: "good" | "warning" | "low";
  onLog?: () => void;
  onSkip?: () => void;
  style?: ViewStyle;
}

export function MedicationCard({
  emoji,
  name,
  dosage,
  nextDoseIn,
  adherencePercent,
  supplyStatus,
  onLog,
  onSkip,
  style,
}: MedicationCardProps) {
  const { colors } = useTheme();
  const dynamicStyles = makeStyles(colors);
  const getSupplyColor = () => {
    switch (supplyStatus) {
      case "good":
        return StatusColors.success;
      case "warning":
        return StatusColors.warning;
      case "low":
        return StatusColors.danger;
      default:
        return StatusColors.info;
    }
  };

  const adherenceColor = useMemo(() => {
    if (!adherencePercent) return StatusColors.info;
    if (adherencePercent >= 90) return StatusColors.success;
    if (adherencePercent >= 70) return StatusColors.warning;
    return StatusColors.danger;
  }, [adherencePercent]);

  return (
    <Pressable
      style={[dynamicStyles.container, style]}
      onPress={onLog}
      android_ripple={{ color: "rgba(239, 68, 68, 0.1)" }}
    >
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.emoji}>{emoji}</Text>
        <View style={dynamicStyles.titleSection}>
          <Text style={dynamicStyles.name}>{name}</Text>
          <Text style={dynamicStyles.dosage}>{dosage}</Text>
        </View>
        {adherencePercent !== undefined && (
          <View style={[dynamicStyles.adherenceRing, { borderColor: adherenceColor }]}>
            <Text style={[dynamicStyles.adherenceText, { color: adherenceColor }]}>
              {adherencePercent}%
            </Text>
          </View>
        )}
      </View>

      {nextDoseIn && (
        <View style={dynamicStyles.nextDose}>
          <Text style={dynamicStyles.nextDoseLabel}>Next dose: </Text>
          <Text style={dynamicStyles.nextDoseTime}>{nextDoseIn}</Text>
        </View>
      )}

      {supplyStatus && (
        <View style={dynamicStyles.footer}>
          <View
            style={[
              dynamicStyles.supplyBadge,
              { backgroundColor: getSupplyColor() + "20" },
            ]}
          >
            <Text
              style={[
                dynamicStyles.supplyText,
                { color: getSupplyColor() },
              ]}
            >
              {supplyStatus === "good" && "✓ Good supply"}
              {supplyStatus === "warning" && "⚠ Low supply"}
              {supplyStatus === "low" && "🚨 Critically low"}
            </Text>
          </View>
        </View>
      )}

      {(onLog || onSkip) && (
        <View style={dynamicStyles.actions}>
          {onLog && (
            <Pressable
              style={[dynamicStyles.actionButton, dynamicStyles.logButton]}
              onPress={onLog}
            >
              <Text style={dynamicStyles.actionButtonText}>✓ Log</Text>
            </Pressable>
          )}
          {onSkip && (
            <Pressable
              style={[dynamicStyles.actionButton, dynamicStyles.skipButton]}
              onPress={onSkip}
            >
              <Text style={dynamicStyles.skipButtonText}>Skip</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.md,
    marginVertical: UITokens.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: UITokens.spacing.md,
  },
  emoji: {
    fontSize: 32,
    marginRight: UITokens.spacing.md,
  },
  titleSection: {
    flex: 1,
  },
  name: {
    fontSize: UITokens.typography.h3.fontSize,
    fontWeight: "600",
    color: colors.text,
    marginBottom: UITokens.spacing.xs,
  },
  dosage: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
  },
  adherenceRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  adherenceText: {
    fontSize: UITokens.typography.h3.fontSize,
    fontWeight: "700",
  },
  nextDose: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: UITokens.spacing.md,
    paddingVertical: UITokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: UITokens.spacing.md,
  },
  nextDoseLabel: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
  },
  nextDoseTime: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: colors.orange,
  },
  footer: {
    marginBottom: UITokens.spacing.md,
  },
  supplyBadge: {
    paddingHorizontal: UITokens.spacing.md,
    paddingVertical: UITokens.spacing.sm,
    borderRadius: UITokens.borderRadius.full,
    alignSelf: "flex-start",
  },
  supplyText: {
    fontSize: UITokens.typography.caption.fontSize,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: UITokens.spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: UITokens.touchTarget,
    borderRadius: UITokens.borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  logButton: {
    backgroundColor: colors.green,
  },
  skipButton: {
    backgroundColor: colors.border,
  },
  actionButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "white",
  },
  skipButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});

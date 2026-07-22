import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle, Animated } from "react-native";
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
      style={[styles.container, style]}
      onPress={onLog}
      android_ripple={{ color: "rgba(239, 68, 68, 0.1)" }}
    >
      <View style={styles.header}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.titleSection}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.dosage}>{dosage}</Text>
        </View>
        {adherencePercent !== undefined && (
          <View style={[styles.adherenceRing, { borderColor: adherenceColor }]}>
            <Text style={[styles.adherenceText, { color: adherenceColor }]}>
              {adherencePercent}%
            </Text>
          </View>
        )}
      </View>

      {nextDoseIn && (
        <View style={styles.nextDose}>
          <Text style={styles.nextDoseLabel}>Next dose: </Text>
          <Text style={styles.nextDoseTime}>{nextDoseIn}</Text>
        </View>
      )}

      {supplyStatus && (
        <View style={styles.footer}>
          <View
            style={[
              styles.supplyBadge,
              { backgroundColor: getSupplyColor() + "20" },
            ]}
          >
            <Text
              style={[
                styles.supplyText,
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
        <View style={styles.actions}>
          {onLog && (
            <Pressable
              style={[styles.actionButton, styles.logButton]}
              onPress={onLog}
            >
              <Text style={styles.actionButtonText}>✓ Log</Text>
            </Pressable>
          )}
          {onSkip && (
            <Pressable
              style={[styles.actionButton, styles.skipButton]}
              onPress={onSkip}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1F2937",
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.md,
    marginVertical: UITokens.spacing.sm,
    borderWidth: 1,
    borderColor: "#374151",
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
    color: "#F3F4F6",
    marginBottom: UITokens.spacing.xs,
  },
  dosage: {
    fontSize: UITokens.typography.caption.fontSize,
    color: "#9CA3AF",
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
    borderTopColor: "#374151",
    paddingTop: UITokens.spacing.md,
  },
  nextDoseLabel: {
    fontSize: UITokens.typography.caption.fontSize,
    color: "#9CA3AF",
  },
  nextDoseTime: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "#F59E0B",
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
    backgroundColor: "#10B981",
  },
  skipButton: {
    backgroundColor: "#374151",
  },
  actionButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "white",
  },
  skipButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "#9CA3AF",
  },
});

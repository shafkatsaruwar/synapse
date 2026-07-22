import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { UITokens, StatusColors } from "@/constants/ui-design";

interface QuickAddBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    energy: number;
    mood: number;
    sleep: number;
  }) => void;
}

export function QuickAddBottomSheet({
  visible,
  onClose,
  onSubmit,
}: QuickAddBottomSheetProps) {
  const [energy, setEnergy] = useState(5);
  const [mood, setMood] = useState(5);
  const [sleep, setSleep] = useState(7);

  const handleSubmit = () => {
    onSubmit({ energy, mood, sleep });
    onClose();
  };

  const ScaleButtons = ({
    value,
    onChange,
  }: {
    value: number;
    onChange: (v: number) => void;
  }) => (
    <View style={styles.scaleContainer}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
        <Pressable
          key={num}
          style={[
            styles.scaleButton,
            value === num && styles.scaleButtonActive,
            value === num && {
              backgroundColor: getScaleColor(num),
            },
          ]}
          onPress={() => onChange(num)}
        >
          <Text
            style={[
              styles.scaleButtonText,
              value === num && styles.scaleButtonTextActive,
            ]}
          >
            {num}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const getScaleColor = (value: number) => {
    if (value <= 3) return StatusColors.danger;
    if (value <= 6) return StatusColors.warning;
    return StatusColors.success;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Daily Check-in</Text>
              <Text style={styles.subtitle}>60-second snapshot</Text>
              <Pressable
                style={styles.closeButton}
                onPress={onClose}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            {/* Energy */}
            <View style={styles.metric}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricTitle}>⚡ Energy Level</Text>
                <Text style={[styles.metricValue, { color: getScaleColor(energy) }]}>
                  {energy}/10
                </Text>
              </View>
              <ScaleButtons value={energy} onChange={setEnergy} />
            </View>

            {/* Mood */}
            <View style={styles.metric}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricTitle}>😊 Mood</Text>
                <Text style={[styles.metricValue, { color: getScaleColor(mood) }]}>
                  {mood}/10
                </Text>
              </View>
              <ScaleButtons value={mood} onChange={setMood} />
            </View>

            {/* Sleep */}
            <View style={styles.metric}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricTitle}>😴 Sleep (hours)</Text>
                <Text style={[styles.metricValue, { color: getScaleColor(sleep) }]}>
                  {sleep}h
                </Text>
              </View>
              <View style={styles.sleepContainer}>
                {[3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <Pressable
                    key={num}
                    style={[
                      styles.sleepButton,
                      sleep === num && styles.sleepButtonActive,
                      sleep === num && {
                        backgroundColor: getScaleColor(num),
                      },
                    ]}
                    onPress={() => setSleep(num)}
                  >
                    <Text
                      style={[
                        styles.sleepButtonText,
                        sleep === num && styles.sleepButtonTextActive,
                      ]}
                    >
                      {num}h
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.submitButton]}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>✓ Save Check-in</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#111827",
    borderTopLeftRadius: UITokens.borderRadius.xl,
    borderTopRightRadius: UITokens.borderRadius.xl,
    maxHeight: "90%",
  },
  content: {
    padding: UITokens.spacing.lg,
  },
  header: {
    marginBottom: UITokens.spacing.xl,
    position: "relative",
  },
  title: {
    fontSize: UITokens.typography.h2.fontSize,
    fontWeight: "700",
    color: "#F3F4F6",
    marginBottom: UITokens.spacing.sm,
  },
  subtitle: {
    fontSize: UITokens.typography.caption.fontSize,
    color: "#9CA3AF",
  },
  closeButton: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    fontSize: 24,
    color: "#9CA3AF",
  },
  metric: {
    marginBottom: UITokens.spacing.xl,
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: UITokens.spacing.md,
  },
  metricTitle: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "#F3F4F6",
  },
  metricValue: {
    fontSize: UITokens.typography.h3.fontSize,
    fontWeight: "700",
  },
  scaleContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: UITokens.spacing.sm,
  },
  scaleButton: {
    width: "18%",
    aspectRatio: 1,
    borderRadius: UITokens.borderRadius.sm,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#374151",
  },
  scaleButtonActive: {
    borderColor: "transparent",
  },
  scaleButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  scaleButtonTextActive: {
    color: "white",
  },
  sleepContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: UITokens.spacing.sm,
  },
  sleepButton: {
    flex: 1,
    minWidth: "22%",
    paddingVertical: UITokens.spacing.md,
    borderRadius: UITokens.borderRadius.sm,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#374151",
  },
  sleepButtonActive: {
    borderColor: "transparent",
  },
  sleepButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  sleepButtonTextActive: {
    color: "white",
  },
  actions: {
    flexDirection: "row",
    gap: UITokens.spacing.md,
    marginTop: UITokens.spacing.xl,
    marginBottom: UITokens.spacing.lg,
  },
  button: {
    flex: 1,
    minHeight: UITokens.touchTarget,
    borderRadius: UITokens.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#1F2937",
    borderWidth: 2,
    borderColor: "#374151",
  },
  cancelButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  submitButton: {
    backgroundColor: "#10B981",
  },
  submitButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "white",
  },
});

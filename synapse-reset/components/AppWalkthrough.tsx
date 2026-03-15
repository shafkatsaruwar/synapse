import React, { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Modal, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";

const WALKTHROUGH_STEPS: { title: string; body: string }[] = [
  { title: "Medications", body: "Track the medicines you take every day." },
  { title: "Daily Log", body: "Log your mood, energy, and how you're feeling." },
  { title: "Appointments", body: "Keep track of your doctor visits." },
  { title: "Emergency Protocol", body: "Quick access instructions for emergencies." },
];

interface AppWalkthroughProps {
  visible: boolean;
  onComplete: () => void;
}

export default function AppWalkthrough({ visible, onComplete }: AppWalkthroughProps) {
  const [step, setStep] = useState(0);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C, insets), [C, insets]);

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  if (!visible) return null;

  const current = WALKTHROUGH_STEPS[step];
  const isLast = step === WALKTHROUGH_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.dim}>
        <View style={[styles.tooltipCard, { maxWidth: Math.min(width - 32, 360) }]}>
          <Text style={styles.stepLabel}>Step {step + 1} of {WALKTHROUGH_STEPS.length}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.8 : 1 }]}
              onPress={handleSkip}
              accessibilityRole="button"
              accessibilityLabel="Skip tour"
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.nextBtn, { opacity: pressed ? 0.9 : 1 }]}
              onPress={handleNext}
              accessibilityRole="button"
              accessibilityLabel={isLast ? "Finish tour" : "Next"}
            >
              <Text style={styles.nextText}>{isLast ? "Done" : "Next"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: Theme, insets: { top: number; bottom: number }) {
  return StyleSheet.create({
    dim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    },
    tooltipCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 24,
      width: "100%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 12,
    },
    stepLabel: {
      fontSize: 12,
      color: C.textTertiary,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: C.textPrimary,
      marginBottom: 8,
    },
    body: {
      fontSize: 16,
      color: C.textSecondary,
      lineHeight: 24,
      marginBottom: 24,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
    },
    skipBtn: {
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    skipText: {
      fontSize: 16,
      color: C.textSecondary,
      fontWeight: "500",
    },
    nextBtn: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: C.tint,
      borderRadius: 12,
    },
    nextText: {
      fontSize: 16,
      color: "#fff",
      fontWeight: "600",
    },
  });
}

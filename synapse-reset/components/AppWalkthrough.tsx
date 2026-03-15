import React, { useState, useMemo, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Modal, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useWalkthroughTargets } from "@/contexts/WalkthroughContext";

const WALKTHROUGH_STEPS: { id: string; title: string; body: string }[] = [
  { id: "medication", title: "Medications", body: "Track the medicines you take every day." },
  { id: "dailylog", title: "Daily Log", body: "Log your mood, energy, and how you're feeling." },
  { id: "appointments", title: "Appointments", body: "Keep track of your doctor visits." },
  { id: "menu", title: "Emergency Protocol", body: "Quick access instructions for emergencies. Open the menu to find Emergency Protocol." },
];

const TOOLTIP_GAP = 12;
const ARROW_SIZE = 10;
const HIGHLIGHT_PADDING = 8;
const HIGHLIGHT_BORDER = 3;

interface AppWalkthroughProps {
  visible: boolean;
  onComplete: () => void;
}

export default function AppWalkthrough({ visible, onComplete }: AppWalkthroughProps) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const { colors: C } = useTheme();
  const targets = useWalkthroughTargets();

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  const stepId = WALKTHROUGH_STEPS[step]?.id;
  const measureTarget = targets?.getTarget(stepId);

  useEffect(() => {
    if (!visible || !measureTarget) {
      setTargetRect(null);
      return;
    }
    let cancelled = false;
    measureTarget().then((rect) => {
      if (!cancelled && rect) setTargetRect(rect);
      else if (!cancelled) setTargetRect(null);
    });
    return () => { cancelled = true; };
  }, [visible, step, stepId, measureTarget]);

  const current = WALKTHROUGH_STEPS[step];
  const isLast = step === WALKTHROUGH_STEPS.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete();
      return;
    }
    setStep((s) => s + 1);
  }, [isLast, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const tooltipWidth = Math.min(winWidth - 32, 360);
  const tooltipHeight = 180;

  const placement = useMemo(() => {
    if (!targetRect) {
      return {
        tooltipX: (winWidth - tooltipWidth) / 2,
        tooltipY: winHeight / 2 - tooltipHeight / 2,
        arrow: "none" as const,
      };
    }
    const spaceAbove = targetRect.y - insets.top;
    const spaceBelow = winHeight - (targetRect.y + targetRect.height) - insets.bottom;
    const preferAbove = spaceAbove >= tooltipHeight + TOOLTIP_GAP + ARROW_SIZE;
    const preferBelow = spaceBelow >= tooltipHeight + TOOLTIP_GAP + ARROW_SIZE;
    const centerX = targetRect.x + targetRect.width / 2;
    const tooltipX = Math.max(16, Math.min(winWidth - 16 - tooltipWidth, centerX - tooltipWidth / 2));
    if (preferAbove) {
      const tooltipY = targetRect.y - TOOLTIP_GAP - tooltipHeight;
      return { tooltipX, tooltipY, arrow: "down" as const, arrowX: centerX - tooltipX };
    }
    if (preferBelow) {
      const tooltipY = targetRect.y + targetRect.height + TOOLTIP_GAP;
      return { tooltipX, tooltipY, arrow: "up" as const, arrowX: centerX - tooltipX };
    }
    const tooltipY = Math.max(insets.top + 8, Math.min(winHeight - insets.bottom - tooltipHeight - 8, targetRect.y + targetRect.height / 2 - tooltipHeight / 2));
    return { tooltipX, tooltipY, arrow: spaceAbove >= spaceBelow ? "down" : "up", arrowX: centerX - tooltipX };
  }, [targetRect, winWidth, winHeight, insets.top, insets.bottom, tooltipWidth, tooltipHeight]);

  const highlightRect = targetRect
    ? {
        left: targetRect.x - HIGHLIGHT_PADDING,
        top: targetRect.y - HIGHLIGHT_PADDING,
        width: targetRect.width + HIGHLIGHT_PADDING * 2,
        height: targetRect.height + HIGHLIGHT_PADDING * 2,
      }
    : null;

  const styles = useMemo(() => makeStyles(C), [C]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.dim, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {highlightRect && (
          <View
            style={[
              styles.highlight,
              {
                position: "absolute",
                left: highlightRect.left,
                top: highlightRect.top,
                width: highlightRect.width,
                height: highlightRect.height,
                borderRadius: 16,
              },
            ]}
          />
        )}

        <View
          style={[
            styles.tooltipCard,
            {
              position: "absolute",
              left: placement.tooltipX,
              top: placement.tooltipY,
              width: tooltipWidth,
              minHeight: tooltipHeight,
            },
          ]}
        >
          {placement.arrow !== "none" && typeof placement.arrowX === "number" && (
            <View
              style={[
                styles.arrow,
                placement.arrow === "down" && styles.arrowDown,
                placement.arrow === "up" && styles.arrowUp,
                { left: Math.max(16, Math.min(tooltipWidth - 2 * ARROW_SIZE, placement.arrowX - ARROW_SIZE)) },
              ]}
            />
          )}
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

function makeStyles(C: Theme) {
  return StyleSheet.create({
    dim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      paddingHorizontal: 0,
    },
    highlight: {
      borderWidth: HIGHLIGHT_BORDER,
      borderColor: "rgba(255,255,255,0.9)",
      backgroundColor: "transparent",
      shadowColor: "#fff",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    tooltipCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 12,
    },
    arrow: {
      position: "absolute",
      width: 0,
      height: 0,
      borderLeftWidth: ARROW_SIZE,
      borderRightWidth: ARROW_SIZE,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
    },
    arrowDown: {
      bottom: -ARROW_SIZE,
      borderTopWidth: ARROW_SIZE,
      borderTopColor: C.surface,
      borderBottomWidth: 0,
    },
    arrowUp: {
      top: -ARROW_SIZE,
      borderTopWidth: 0,
      borderBottomWidth: ARROW_SIZE,
      borderBottomColor: C.surface,
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

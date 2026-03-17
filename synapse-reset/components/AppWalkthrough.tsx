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

const TOOLTIP_GAP = 14;
const ARROW_SIZE = 10;
const SPOTLIGHT_PADDING = 10;
const SPOTLIGHT_RADIUS = 14;
const DIM_COLOR = "rgba(0,0,0,0.62)";

interface AppWalkthroughProps {
  visible: boolean;
  onComplete: () => void;
}

type Rect = { x: number; y: number; width: number; height: number };

export default function AppWalkthrough({ visible, onComplete }: AppWalkthroughProps) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
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
    // Small delay so refs are laid out before measuring
    const timer = setTimeout(() => {
      measureTarget().then((rect) => {
        if (!cancelled) setTargetRect(rect ?? null);
      });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, step, stepId, measureTarget]);

  const current = WALKTHROUGH_STEPS[step];
  const isLast = step === WALKTHROUGH_STEPS.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) { onComplete(); return; }
    setStep((s) => s + 1);
  }, [isLast, onComplete]);

  const handleSkip = useCallback(() => { onComplete(); }, [onComplete]);

  const tooltipWidth = Math.min(winWidth - 32, 340);
  const tooltipHeight = 175;

  // Spotlight rect (padded around the target)
  const spot = targetRect
    ? {
        x: targetRect.x - SPOTLIGHT_PADDING,
        y: targetRect.y - SPOTLIGHT_PADDING,
        w: targetRect.width + SPOTLIGHT_PADDING * 2,
        h: targetRect.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  // Tooltip placement: prefer below, then above, then centered
  const placement = useMemo(() => {
    if (!spot) {
      return {
        tooltipX: (winWidth - tooltipWidth) / 2,
        tooltipY: winHeight / 2 - tooltipHeight / 2,
        arrow: "none" as const,
      };
    }
    const spaceAbove = spot.y - insets.top;
    const spaceBelow = winHeight - (spot.y + spot.h) - insets.bottom;
    const centerX = spot.x + spot.w / 2;
    const tooltipX = Math.max(16, Math.min(winWidth - 16 - tooltipWidth, centerX - tooltipWidth / 2));
    const arrowX = centerX - tooltipX;

    if (spaceBelow >= tooltipHeight + TOOLTIP_GAP + ARROW_SIZE) {
      return { tooltipX, tooltipY: spot.y + spot.h + TOOLTIP_GAP, arrow: "up" as const, arrowX };
    }
    if (spaceAbove >= tooltipHeight + TOOLTIP_GAP + ARROW_SIZE) {
      return { tooltipX, tooltipY: spot.y - TOOLTIP_GAP - tooltipHeight, arrow: "down" as const, arrowX };
    }
    // Fallback: place below but allow overlap, no arrow
    return { tooltipX, tooltipY: spot.y + spot.h + TOOLTIP_GAP, arrow: "none" as const };
  }, [spot, winWidth, winHeight, insets.top, insets.bottom, tooltipWidth, tooltipHeight]);

  const styles = useMemo(() => makeStyles(C), [C]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

        {/* Dim overlay: 4 rectangles around the spotlight, or full-screen if no target */}
        {spot ? (
          <>
            {/* Top */}
            <View style={[styles.dimRect, { left: 0, top: 0, right: 0, height: spot.y }]} />
            {/* Bottom */}
            <View style={[styles.dimRect, { left: 0, top: spot.y + spot.h, right: 0, bottom: 0 }]} />
            {/* Left */}
            <View style={[styles.dimRect, { left: 0, top: spot.y, width: spot.x, height: spot.h }]} />
            {/* Right */}
            <View style={[styles.dimRect, { left: spot.x + spot.w, top: spot.y, right: 0, height: spot.h }]} />
            {/* Spotlight border ring */}
            <View
              style={{
                position: "absolute",
                left: spot.x,
                top: spot.y,
                width: spot.w,
                height: spot.h,
                borderRadius: SPOTLIGHT_RADIUS,
                borderWidth: 2.5,
                borderColor: "rgba(255,255,255,0.85)",
                shadowColor: "#fff",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 10,
              }}
            />
          </>
        ) : (
          <View style={[styles.dimRect, StyleSheet.absoluteFillObject]} />
        )}

        {/* Tooltip card */}
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
    dimRect: {
      position: "absolute",
      backgroundColor: DIM_COLOR,
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

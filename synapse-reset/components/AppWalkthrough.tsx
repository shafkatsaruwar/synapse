import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  useWindowDimensions,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useWalkthroughTargets } from "@/contexts/WalkthroughContext";

// ─── Step definitions ────────────────────────────────────────────────────────

const WALKTHROUGH_STEPS: { id: string; title: string; body: string }[] = [
  { id: "medication",   title: "Medications",        body: "Track the medicines you take every day." },
  { id: "dailylog",     title: "Daily Log",          body: "Log your mood, energy, and how you're feeling." },
  { id: "appointments", title: "Appointments",       body: "Keep track of your doctor visits." },
  { id: "menu",         title: "Emergency Protocol", body: "Quick access to emergency instructions. Open the menu to find Emergency Protocol." },
];

// ─── Layout constants ────────────────────────────────────────────────────────

const TOOLTIP_GAP       = 14;   // gap between spotlight edge and tooltip
const ARROW_SIZE        = 11;   // half-base of the CSS triangle arrow
const SPOTLIGHT_PADDING = 10;   // extra space around the target element
const SPOTLIGHT_RADIUS  = 14;
const DIM_COLOR         = "rgba(0,0,0,0.65)";

// ─── Animation constants ─────────────────────────────────────────────────────

const ANIM_DIM_MS     = 220;   // overlay fade-in
const ANIM_IN_MS      = 260;   // tooltip slide-in
const ANIM_OUT_MS     = 180;   // tooltip slide-out between steps
const SLIDE_DIST      = 14;    // px the tooltip slides while fading

// ─── Types ───────────────────────────────────────────────────────────────────

type Rect      = { x: number; y: number; width: number; height: number };
type ArrowDir  = "up" | "down" | "none";

interface Placement {
  tooltipX: number;
  tooltipY: number;
  arrow: ArrowDir;
  arrowX?: number;
}

interface AppWalkthroughProps {
  visible: boolean;
  onComplete: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AppWalkthrough({ visible, onComplete }: AppWalkthroughProps) {
  const [step,        setStep]       = useState(0);
  const [targetRect,  setTargetRect] = useState<Rect | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const insets  = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const { colors: C } = useTheme();
  const targets = useWalkthroughTargets();

  // Animated values
  const dimOpacity     = useRef(new Animated.Value(0)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipSlide   = useRef(new Animated.Value(SLIDE_DIST)).current;

  // ── Reset state when tour opens ───────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setStep(0);
      setTargetRect(null);
      tooltipOpacity.setValue(0);
      tooltipSlide.setValue(SLIDE_DIST);
      dimOpacity.setValue(0);
      // Fade in overlay first, then slide tooltip in
      Animated.timing(dimOpacity, {
        toValue: 1,
        duration: ANIM_DIM_MS,
        useNativeDriver: true,
      }).start();
    } else {
      dimOpacity.setValue(0);
    }
  }, [visible]);

  // ── Measure target on step change ─────────────────────────────────────────
  const stepId = WALKTHROUGH_STEPS[step]?.id;
  const measureTarget = targets?.getTarget(stepId);

  useEffect(() => {
    if (!visible || !measureTarget) {
      setTargetRect(null);
      return;
    }
    let cancelled = false;
    tooltipOpacity.setValue(0);
    tooltipSlide.setValue(SLIDE_DIST);

    const timer = setTimeout(() => {
      measureTarget().then((rect) => {
        if (cancelled) return;
        setTargetRect(rect ?? null);
        // Slide+fade tooltip in
        Animated.parallel([
          Animated.timing(tooltipOpacity, {
            toValue: 1,
            duration: ANIM_IN_MS,
            useNativeDriver: true,
          }),
          Animated.timing(tooltipSlide, {
            toValue: 0,
            duration: ANIM_IN_MS,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 140);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, step, stepId, measureTarget]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const current = WALKTHROUGH_STEPS[step];
  const isLast  = step === WALKTHROUGH_STEPS.length - 1;

  const animateOut = useCallback((cb: () => void) => {
    setTransitioning(true);
    Animated.parallel([
      Animated.timing(tooltipOpacity, {
        toValue: 0,
        duration: ANIM_OUT_MS,
        useNativeDriver: true,
      }),
      Animated.timing(tooltipSlide, {
        toValue: -SLIDE_DIST,
        duration: ANIM_OUT_MS,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTransitioning(false);
      cb();
    });
  }, [tooltipOpacity, tooltipSlide]);

  const handleNext = useCallback(() => {
    if (transitioning) return;
    if (isLast) {
      animateOut(() => onComplete());
    } else {
      animateOut(() => setStep((s) => s + 1));
    }
  }, [isLast, transitioning, animateOut, onComplete]);

  const handleSkip = useCallback(() => {
    if (transitioning) return;
    animateOut(() => onComplete());
  }, [transitioning, animateOut, onComplete]);

  // ── Layout ────────────────────────────────────────────────────────────────
  const tooltipWidth  = Math.min(winWidth - 32, 340);
  const tooltipHeight = 180;

  const spot = targetRect
    ? {
        x: targetRect.x - SPOTLIGHT_PADDING,
        y: targetRect.y - SPOTLIGHT_PADDING,
        w: targetRect.width  + SPOTLIGHT_PADDING * 2,
        h: targetRect.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  const placement = useMemo<Placement>(() => {
    if (!spot) {
      return {
        tooltipX: (winWidth - tooltipWidth) / 2,
        tooltipY: winHeight / 2 - tooltipHeight / 2,
        arrow: "none",
      };
    }
    const spaceAbove = spot.y - insets.top;
    const spaceBelow = winHeight - (spot.y + spot.h) - insets.bottom;
    const centerX    = spot.x + spot.w / 2;
    const tooltipX   = Math.max(16, Math.min(winWidth - 16 - tooltipWidth, centerX - tooltipWidth / 2));
    const arrowX     = centerX - tooltipX;

    if (spaceBelow >= tooltipHeight + TOOLTIP_GAP + ARROW_SIZE) {
      return { tooltipX, tooltipY: spot.y + spot.h + TOOLTIP_GAP, arrow: "up", arrowX };
    }
    if (spaceAbove >= tooltipHeight + TOOLTIP_GAP + ARROW_SIZE) {
      return { tooltipX, tooltipY: spot.y - TOOLTIP_GAP - tooltipHeight, arrow: "down", arrowX };
    }
    return { tooltipX, tooltipY: spot.y + spot.h + TOOLTIP_GAP, arrow: "none" };
  }, [spot, winWidth, winHeight, insets.top, insets.bottom, tooltipWidth, tooltipHeight]);

  // Arrow slides opposite to tooltip (toward the target)
  const arrowDirection = placement.arrow === "up" ? 1 : -1;
  const tooltipAnimStyle = {
    opacity:   tooltipOpacity,
    transform: [{ translateY: Animated.multiply(tooltipSlide, new Animated.Value(arrowDirection)) }],
  };

  const styles = useMemo(() => makeStyles(C), [C]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

        {/* ── Dim overlay (4-rect cutout spotlight) ── */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: dimOpacity }]} pointerEvents="none">
          {spot ? (
            <>
              <View style={[styles.dimRect, { left: 0, top: 0, right: 0, height: spot.y }]} />
              <View style={[styles.dimRect, { left: 0, top: spot.y + spot.h, right: 0, bottom: 0 }]} />
              <View style={[styles.dimRect, { left: 0, top: spot.y, width: spot.x, height: spot.h }]} />
              <View style={[styles.dimRect, { left: spot.x + spot.w, top: spot.y, right: 0, height: spot.h }]} />
            </>
          ) : (
            <View style={[styles.dimRect, StyleSheet.absoluteFillObject]} />
          )}
        </Animated.View>

        {/* ── Spotlight ring (animates with dim) ── */}
        {spot && (
          <Animated.View
            style={[
              styles.spotRing,
              {
                left:   spot.x,
                top:    spot.y,
                width:  spot.w,
                height: spot.h,
                opacity: dimOpacity,
              },
            ]}
            pointerEvents="none"
          />
        )}

        {/* ── Anchored tooltip card ── */}
        <Animated.View
          style={[
            styles.tooltipCard,
            {
              position: "absolute",
              left:      placement.tooltipX,
              top:       placement.tooltipY,
              width:     tooltipWidth,
              minHeight: tooltipHeight,
            },
            tooltipAnimStyle,
          ]}
        >
          {/* Speech-bubble arrow */}
          {placement.arrow !== "none" && typeof placement.arrowX === "number" && (
            <View
              style={[
                styles.arrow,
                placement.arrow === "down" ? styles.arrowDown : styles.arrowUp,
                {
                  left: Math.max(16, Math.min(
                    tooltipWidth - 2 * ARROW_SIZE - 4,
                    placement.arrowX - ARROW_SIZE,
                  )),
                },
              ]}
            />
          )}

          {/* Step dots */}
          <View style={styles.dotsRow}>
            {WALKTHROUGH_STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step && styles.dotActive]}
              />
            ))}
          </View>

          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Skip tour"
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>

            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [styles.nextBtn, { opacity: pressed ? 0.85 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={isLast ? "Finish tour" : "Next step"}
            >
              <Text style={styles.nextText}>{isLast ? "Done" : "Next"}</Text>
            </Pressable>
          </View>
        </Animated.View>

      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(C: Theme) {
  return StyleSheet.create({
    dimRect: {
      position: "absolute",
      backgroundColor: DIM_COLOR,
    },
    spotRing: {
      position: "absolute",
      borderRadius: SPOTLIGHT_RADIUS,
      borderWidth: 2.5,
      borderColor: "rgba(255,255,255,0.88)",
      shadowColor: "#fff",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: 12,
    },
    tooltipCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 22,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.22,
      shadowRadius: 20,
      elevation: 14,
    },
    // CSS-triangle arrow pointing toward target
    arrow: {
      position: "absolute",
      width: 0,
      height: 0,
      borderLeftWidth: ARROW_SIZE,
      borderRightWidth: ARROW_SIZE,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
    },
    arrowUp: {
      top: -ARROW_SIZE,
      borderTopWidth: 0,
      borderBottomWidth: ARROW_SIZE,
      borderBottomColor: C.surface,
    },
    arrowDown: {
      bottom: -ARROW_SIZE,
      borderTopWidth: ARROW_SIZE,
      borderTopColor: C.surface,
      borderBottomWidth: 0,
    },
    // Step indicator dots
    dotsRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 14,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: C.border ?? "rgba(128,128,128,0.35)",
    },
    dotActive: {
      width: 18,
      borderRadius: 3,
      backgroundColor: C.tint,
    },
    title: {
      fontSize: 19,
      fontWeight: "700",
      color: C.text,
      marginBottom: 7,
    },
    body: {
      fontSize: 15,
      color: C.textSecondary,
      lineHeight: 22,
      marginBottom: 22,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 8,
    },
    skipBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    skipText: {
      fontSize: 15,
      color: C.textTertiary,
      fontWeight: "500",
    },
    nextBtn: {
      paddingVertical: 11,
      paddingHorizontal: 22,
      backgroundColor: C.tint,
      borderRadius: 11,
    },
    nextText: {
      fontSize: 15,
      color: "#fff",
      fontWeight: "600",
    },
  });
}

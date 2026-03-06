import { useState, useEffect, useMemo } from "react";
import { AccessibilityInfo } from "react-native";
import Colors from "@/constants/colors";
import { settingsStorage } from "@/lib/storage";

export function getColors(highContrast: boolean) {
  return highContrast ? Colors.highContrast : Colors.dark;
}

export function shouldReduceMotion(): Promise<boolean> {
  return AccessibilityInfo.isReduceMotionEnabled();
}

export function useAccessibility() {
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    settingsStorage.get().then((s) => {
      setHighContrast(!!s.highContrast);
    });

    shouldReduceMotion().then(setReduceMotion);

    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      sub?.remove();
    };
  }, []);

  const colors = useMemo(() => getColors(highContrast), [highContrast]);

  return { highContrast, reduceMotion, colors };
}

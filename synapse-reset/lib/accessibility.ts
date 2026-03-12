import { useState, useEffect } from "react";
import { AccessibilityInfo } from "react-native";

export function shouldReduceMotion(): Promise<boolean> {
  return AccessibilityInfo.isReduceMotionEnabled();
}

export function useAccessibility() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    shouldReduceMotion().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { sub?.remove(); };
  }, []);

  return { reduceMotion };
}

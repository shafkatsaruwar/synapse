/**
 * Safe wrapper for useSafeAreaInsets so the app never crashes if the hook
 * is undefined or the package fails to load (e.g. standalone iOS production).
 */
const defaultInsets = { top: 0, bottom: 0, left: 0, right: 0 };

let useSafeAreaInsetsImpl: () => typeof defaultInsets = () => defaultInsets;
try {
  const SafeAreaContext = require("react-native-safe-area-context");
  if (typeof SafeAreaContext?.useSafeAreaInsets === "function") {
    useSafeAreaInsetsImpl = SafeAreaContext.useSafeAreaInsets;
  }
} catch {
  // use fallback when package fails to load (e.g. native module not linked)
}

export const useSafeAreaInsets: () => {
  top: number;
  bottom: number;
  left: number;
  right: number;
} = useSafeAreaInsetsImpl;

import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Pressable, AppState, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useTheme } from "@/contexts/ThemeContext";
import { getBiometricLockEnabled } from "@/lib/biometric-storage";
import { Ionicons } from "@expo/vector-icons";

interface BiometricGateProps {
  children: React.ReactNode;
}

export default function BiometricGate({ children }: BiometricGateProps) {
  const { colors: C } = useTheme();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authenticatingRef = useRef(false);

  const authenticate = useCallback(async () => {
    if (Platform.OS === "web") {
      setUnlocked(true);
      return;
    }
    if (authenticatingRef.current) return;
    authenticatingRef.current = true;
    setIsAuthenticating(true);
    setError(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Synapse",
        fallbackLabel: "Use passcode",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setFailCount(0);
        setUnlocked(true);
      } else {
        const isCancel = result.error === "user_cancel";
        if (!isCancel) {
          setFailCount((c) => c + 1);
          setError("Authentication failed. Try again.");
        }
      }
    } catch (e) {
      setFailCount((c) => c + 1);
      setError("Authentication unavailable.");
    } finally {
      authenticatingRef.current = false;
      setIsAuthenticating(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getBiometricLockEnabled().then((value) => {
      if (mounted) {
        setEnabled(value);
        if (!value || Platform.OS === "web") setUnlocked(true);
      }
    });
    return () => { mounted = false; };
  }, []);

  // Only lock when app goes to background. Do NOT set unlocked=false on "active" — that caused the loop.
  useEffect(() => {
    if (Platform.OS === "web" || enabled !== true) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        setUnlocked(false);
        setError(null);
        setFailCount(0);
      }
    });
    return () => sub.remove();
  }, [enabled]);

  if (enabled === null) {
    return <View style={[styles.centered, { backgroundColor: C.background }]} />;
  }

  if (!enabled || unlocked) {
    return <>{children}</>;
  }

  const handleTryAgain = () => {
    setError(null);
    authenticate();
  };

  const handleCancel = () => {
    setError(null);
    setUnlocked(true);
  };

  const handlePasscodeFallback = () => {
    setError(null);
    setUnlocked(true);
  };

  return (
    <View style={[styles.centered, styles.lockScreen, { backgroundColor: C.background }]}>
      <View style={[styles.lockIconWrap, { backgroundColor: C.surface }]}>
        <Ionicons name="lock-closed" size={48} color={C.tint} />
      </View>
      <Text style={[styles.title, { color: C.text }]}>Synapse is locked</Text>
      <Text style={[styles.subtitle, { color: C.textSecondary }]}>
        Use Face ID, Touch ID, or your device passcode to open the app.
      </Text>
      {error ? (
        <>
          <Text style={[styles.errorText, { color: C.red }]}>{error}</Text>
          {failCount >= 3 ? (
            <View style={styles.errorActions}>
              <Pressable
                style={[styles.unlockBtn, { backgroundColor: C.tint, marginRight: 12, opacity: isAuthenticating ? 0.7 : 1 }]}
                onPress={handlePasscodeFallback}
                disabled={isAuthenticating}
                accessibilityRole="button"
                accessibilityLabel="Unlock with passcode"
              >
                <Text style={styles.unlockBtnText}>Unlock with passcode</Text>
              </Pressable>
              <Pressable
                style={[styles.cancelBtn, { borderColor: C.border }]}
                onPress={handleCancel}
                disabled={isAuthenticating}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.cancelBtnText, { color: C.text }]}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.errorActions}>
              <Pressable
                style={[styles.unlockBtn, { backgroundColor: C.tint, marginRight: 12, opacity: isAuthenticating ? 0.7 : 1 }]}
                onPress={handleTryAgain}
                disabled={isAuthenticating}
                accessibilityRole="button"
                accessibilityLabel="Try again"
              >
                <Text style={styles.unlockBtnText}>{isAuthenticating ? "Unlocking…" : "Try Again"}</Text>
              </Pressable>
              <Pressable
                style={[styles.cancelBtn, { borderColor: C.border }]}
                onPress={handleCancel}
                disabled={isAuthenticating}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.cancelBtnText, { color: C.text }]}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <Pressable
          style={[styles.unlockBtn, { backgroundColor: C.tint, opacity: isAuthenticating ? 0.7 : 1 }]}
          onPress={authenticate}
          disabled={isAuthenticating}
          accessibilityRole="button"
          accessibilityLabel="Unlock with biometric or passcode"
        >
          <Text style={styles.unlockBtnText}>{isAuthenticating ? "Unlocking…" : "Unlock"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lockScreen: {
    padding: 32,
  },
  lockIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontWeight: "700",
    fontSize: 22,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontWeight: "400",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  errorActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  unlockBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  unlockBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  cancelBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontWeight: "600",
    fontSize: 16,
  },
});

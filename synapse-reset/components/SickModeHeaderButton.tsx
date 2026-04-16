import React, { useState, useCallback, useEffect, useMemo } from "react";
import { StyleSheet, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { settingsStorage, sickModeStorage, enableRecoveryTracking } from "@/lib/storage";

interface SickModeHeaderButtonProps {
  onActivate: () => void;
  onNavigate: (screen: string) => void;
  refreshKey?: number;
}

export default function SickModeHeaderButton({ onActivate, onNavigate, refreshKey }: SickModeHeaderButtonProps) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [isActive, setIsActive] = useState(false);

  const load = useCallback(async () => {
    const settings = await settingsStorage.get();
    setIsActive(!!settings.sickMode);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handlePress = async () => {
    if (isActive) {
      onNavigate("sickmode");
      return;
    }
    const s = await settingsStorage.get();
    await settingsStorage.save({ ...s, sickMode: true });
    await enableRecoveryTracking();
    const sd = await sickModeStorage.get();
    await sickModeStorage.save({ ...sd, active: true, startedAt: new Date().toISOString() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onActivate();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.pill,
        isActive && styles.pillActive,
        pressed && { opacity: 0.85 },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={isActive ? "Sick Mode active, open recovery" : "Activate Sick Mode"}
      accessibilityHint={isActive ? "Opens sick mode screen" : "Activates recovery protocol"}
    >
      <Ionicons name="shield-outline" size={16} color={isActive ? C.red : "#4A78C2"} />
      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
        {isActive ? "Sick Mode Active" : "Activate Sick Mode"}
      </Text>
    </Pressable>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: "rgba(74,120,194,0.08)",
      borderWidth: 1.5,
      borderColor: "#4A78C2",
    },
    pillActive: {
      backgroundColor: C.tint,
      borderColor: C.tint,
    },
    pillText: {
      fontWeight: "600",
      fontSize: 12,
      color: "#4A78C2",
    },
    pillTextActive: {
      color: C.red,
    },
  });
}

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { StyleSheet, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { settingsStorage, sickModeStorage } from "@/lib/storage";

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
      <Ionicons name="shield-outline" size={16} color={isActive ? C.red : C.tint} />
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
      borderRadius: 999,
      backgroundColor: C.tintLight,
      borderWidth: 1,
      borderColor: C.tint,
    },
    pillActive: {
      backgroundColor: C.tint,
      borderColor: C.tint,
    },
    pillText: {
      fontWeight: "600",
      fontSize: 12,
      color: C.tint,
    },
    pillTextActive: {
      color: C.red,
    },
  });
}

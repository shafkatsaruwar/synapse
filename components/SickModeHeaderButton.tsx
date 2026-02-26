import React, { useState, useCallback, useEffect } from "react";
import { StyleSheet, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { settingsStorage, sickModeStorage } from "@/lib/storage";

const C = Colors.dark;

interface SickModeHeaderButtonProps {
  onActivate: () => void;
  onNavigate: (screen: string) => void;
  refreshKey?: number;
}

export default function SickModeHeaderButton({ onActivate, onNavigate, refreshKey }: SickModeHeaderButtonProps) {
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
      <Ionicons name="shield-outline" size={16} color={isActive ? C.red : "#8B2635"} />
      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
        {isActive ? "Sick Mode Active" : "Sick Mode"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(139, 38, 53, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(139, 38, 53, 0.35)",
  },
  pillActive: {
    backgroundColor: "rgba(139, 38, 53, 0.18)",
    borderColor: "rgba(139, 38, 53, 0.5)",
  },
  pillText: {
    fontWeight: "600",
    fontSize: 12,
    color: "#8B2635",
  },
  pillTextActive: {
    color: C.red,
  },
});

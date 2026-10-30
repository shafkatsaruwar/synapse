import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { usePlus } from "@/contexts/PlusContext";
import { LEGACY_TRANSITION_DAYS } from "@/lib/plus/legacy-migration";
import { softCardSurface } from "@/constants/soft-card";

/** Soft, non-blocking notice for existing installs — never an aggressive paywall. */
export default function LegacyPlusIntroModal() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { showLegacyIntro, dismissLegacyIntro, openPaywall, legacy } = usePlus();

  const untilLabel = legacy?.transitionUntilIso
    ? new Date(legacy.transitionUntilIso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Modal visible={showLegacyIntro} transparent animationType="fade" onRequestClose={dismissLegacyIntro}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.eyebrow}>Synapse Plus</Text>
          <Text style={styles.title}>A clearer free and Plus experience</Text>
          <Text style={styles.body}>
            Medications, appointments, Sick Mode, and your Emergency Card stay free. Tracking, records,
            wellbeing, Check-In, and Care & Support are part of Synapse Plus.
          </Text>
          <Text style={styles.body}>
            Because you already use Synapse, you have {LEGACY_TRANSITION_DAYS} days of Plus access
            {untilLabel ? ` (through ${untilLabel})` : ""} while you explore. Your data is never deleted
            if access later changes.
          </Text>
          <Pressable
            style={styles.primary}
            onPress={() => {
              dismissLegacyIntro();
              openPaywall();
            }}
            accessibilityRole="button"
            accessibilityLabel="See Synapse Plus plans"
          >
            <Text style={styles.primaryText}>See plans</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={dismissLegacyIntro}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.secondaryText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(20, 28, 34, 0.45)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    card: {
      ...softCardSurface({ backgroundColor: C.surface, borderRadius: 22 }),
      width: "100%",
      maxWidth: 400,
      padding: 22,
    },
    eyebrow: { fontSize: 13, fontWeight: "700", color: C.tint, marginBottom: 8 },
    title: { fontSize: 22, fontWeight: "700", color: C.text, marginBottom: 10 },
    body: { fontSize: 15, lineHeight: 22, color: C.textSecondary, marginBottom: 10 },
    primary: {
      marginTop: 10,
      backgroundColor: C.tint,
      borderRadius: 14,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
    secondary: { alignItems: "center", paddingVertical: 14 },
    secondaryText: { fontSize: 15, fontWeight: "600", color: C.textSecondary },
  });
}

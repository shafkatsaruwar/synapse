import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { raised } from "@/constants/raised";

/** Shared look for the Care screens: same rounded cards and accent usage as Appearance Studio. */
export function useCareStyles() {
  const { colors: C } = useTheme();
  return useMemo(() => makeStyles(C), [C]);
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useCareStyles();
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const s = useCareStyles();
  return (
    <Text style={s.sectionLabel} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useCareStyles();
  return <Text style={[s.body, style as object]}>{children}</Text>;
}

export function PrimaryButton({ label, onPress, disabled, busy, icon }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  const s = useCareStyles();
  return (
    <Pressable
      style={({ pressed }) => [s.primaryBtn, (disabled || busy) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
    >
      {busy ? <ActivityIndicator color="#fff" /> : icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
      <Text style={s.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, destructive, disabled, icon }: { label: string; onPress: () => void; destructive?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  const s = useCareStyles();
  const { colors: C } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [s.secondaryBtn, disabled && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? <Ionicons name={icon} size={18} color={destructive ? C.red : C.text} /> : null}
      <Text style={[s.secondaryBtnText, destructive && { color: C.red }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ icon, title, subtitle, right, onPress, accessibilityLabel }: { icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) {
  const s = useCareStyles();
  const { colors: C } = useTheme();
  const content = (
    <>
      {icon ? (
        <View style={s.rowIcon}>
          <Ionicons name={icon} size={20} color={C.tint} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={C.textTertiary} /> : null)}
    </>
  );
  if (!onPress) return <View style={s.row}>{content}</View>;
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `${title}${subtitle ? `, ${subtitle}` : ""}`}>
      {content}
    </Pressable>
  );
}

export function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" }) {
  const s = useCareStyles();
  const { colors: C } = useTheme();
  const color = tone === "good" ? C.green : tone === "warn" ? C.orange : C.textSecondary;
  return (
    <View style={[s.pill, { borderColor: color }]}>
      <Text style={[s.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Notice({ children, icon = "information-circle-outline" }: { children: React.ReactNode; icon?: keyof typeof Ionicons.glyphMap }) {
  const s = useCareStyles();
  const { colors: C } = useTheme();
  return (
    <View style={s.notice}>
      <Ionicons name={icon} size={18} color={C.tint} style={{ marginTop: 1 }} />
      <Text style={s.noticeText}>{children}</Text>
    </View>
  );
}

export function ScreenHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  const s = useCareStyles();
  const { colors: C } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      {onBack ? (
        <Pressable onPress={onBack} style={s.backRow} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={C.tint} />
          <Text style={s.backText}>Back</Text>
        </Pressable>
      ) : null}
      <Text style={s.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    card: { backgroundColor: C.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.border, gap: 8, ...raised("sm") },
    sectionLabel: { fontWeight: "700", fontSize: 12, color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
    body: { fontWeight: "500", fontSize: 14, color: C.textSecondary, lineHeight: 20 },
    title: { fontWeight: "800", fontSize: 28, color: C.text, letterSpacing: -0.4 },
    subtitle: { fontWeight: "500", fontSize: 14, color: C.textSecondary, marginTop: 4, lineHeight: 20 },
    backRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, minHeight: 44 },
    backText: { fontWeight: "600", fontSize: 16, color: C.tint },
    primaryBtn: { minHeight: 48, borderRadius: 14, backgroundColor: C.tint, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16 },
    primaryBtnText: { fontWeight: "700", fontSize: 15, color: "#fff" },
    secondaryBtn: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16 },
    secondaryBtnText: { fontWeight: "700", fontSize: 15, color: C.text },
    row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 6 },
    rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center" },
    rowTitle: { fontWeight: "700", fontSize: 15, color: C.text },
    rowSub: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginTop: 2, lineHeight: 17 },
    pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" },
    pillText: { fontWeight: "700", fontSize: 11 },
    notice: { flexDirection: "row", gap: 8, backgroundColor: C.surfaceElevated, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border },
    noticeText: { flex: 1, fontWeight: "500", fontSize: 13, color: C.textSecondary, lineHeight: 19 },
  });
}

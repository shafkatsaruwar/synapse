import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { isDarkAppearance, useTheme, type Theme, type ThemePreference } from "@/contexts/ThemeContext";
import { ACCENT_SWATCHES } from "@/lib/appearance/accents";
import {
  APP_ICON_OPTIONS,
  canChangeAppIcon,
  getCurrentAppIcon,
  setAppIcon,
  type AppIconId,
} from "@/lib/appearance/app-icons";
import { WALLPAPER_PRESETS } from "@/lib/appearance/wallpapers";
import type { AccentId, SurfaceStyleId, WallpaperId } from "@/lib/appearance/types";
import { raised } from "@/constants/raised";
import { healthProfileStorage } from "@/lib/storage-self";
import { syncWidgetSnapshot } from "@/lib/widget-sync";

type AppearanceStudioScreenProps = {
  onBack?: () => void;
};

const THEMES: { id: ThemePreference; label: string; blurb: string }[] = [
  { id: "system", label: "System", blurb: "Follows your device" },
  { id: "light", label: "Light", blurb: "Clean & classic" },
  { id: "dark", label: "Dark", blurb: "Comfortable charcoal" },
  { id: "evergreen", label: "Evergreen", blurb: "Fresh muted greens" },
  { id: "calm", label: "Calm", blurb: "Warm cream neutrals" },
  { id: "blue", label: "Blue", blurb: "Airy powder blue" },
];

const SURFACES: { id: SurfaceStyleId; label: string; body: string }[] = [
  { id: "solid", label: "Solid", body: "Opaque cards, maximum readability" },
  { id: "soft", label: "Soft", body: "Gentle depth and restrained shadows" },
  { id: "glass", label: "Glass", body: "Soft translucency with layered light" },
];

export default function AppearanceStudioScreen({ onBack }: AppearanceStudioScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const {
    colors: C,
    themeId,
    appearance,
    draftAppearance,
    beginAppearanceDraft,
    updateAppearanceDraft,
    cancelAppearanceDraft,
    commitAppearance,
    resetAppearance,
    savedLooks,
    applySavedLook,
    saveCurrentLook,
    deleteSavedLook,
  } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const active = draftAppearance ?? appearance;
  const [saveName, setSaveName] = useState("");
  const [busy, setBusy] = useState(false);
  const appliedRef = useRef(false);
  const iconsSupported = canChangeAppIcon();
  const [savedIcon, setSavedIcon] = useState<AppIconId>("default");
  const [pickedIcon, setPickedIcon] = useState<AppIconId>("default");
  const isDarkSurface = isDarkAppearance(themeId);

  useEffect(() => {
    appliedRef.current = false;
    beginAppearanceDraft();
    return () => {
      // Leaving without Apply restores committed look.
      // Skip cancel after a successful Apply so Dark/Light is not discarded on unmount.
      if (!appliedRef.current) cancelAppearanceDraft();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount only
  }, []);

  useEffect(() => {
    if (!iconsSupported) return;
    let cancelled = false;
    getCurrentAppIcon().then((id) => {
      if (cancelled) return;
      setSavedIcon(id);
      setPickedIcon(id);
    });
    return () => {
      cancelled = true;
    };
  }, [iconsSupported]);

  const previewCols = Platform.OS === "ios" || width >= 400 ? 3 : 2;
  const THEME_GAP = 10;
  const themeRows = Array.from({ length: Math.ceil(THEMES.length / previewCols) }, (_, i) =>
    THEMES.slice(i * previewCols, (i + 1) * previewCols),
  );

  const handleApply = async () => {
    setBusy(true);
    try {
      await commitAppearance();
      appliedRef.current = true;
      const profile = await healthProfileStorage.get();
      await healthProfileStorage.save({
        ...profile,
        widgetAppearance:
          active.widgetAppearance === "calm" ? "system" : active.widgetAppearance,
      });
      await syncWidgetSnapshot().catch(() => {});
      if (iconsSupported && pickedIcon !== savedIcon) {
        try {
          await setAppIcon(pickedIcon);
        } catch {
          Alert.alert("Couldn't change the app icon", "Your other appearance changes were saved. Try the icon again in a moment.");
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onBack?.();
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    cancelAppearanceDraft();
    onBack?.();
  };

  const handleReset = () => {
    Alert.alert("Reset Appearance?", "Return to the default Soft Evergreen look?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          await resetAppearance();
          beginAppearanceDraft();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const pickCustomWallpaper = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos needed", "Allow photo access to choose a custom wallpaper. It stays on this device.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    updateAppearanceDraft({ wallpaper: "custom", customWallpaperUri: result.assets[0].uri });
  };

  const topPad = isWide ? 28 : Platform.OS === "web" ? 40 : 8;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>Your health. Your space. Your way.</Text>
        <Text style={styles.title}>Appearance Studio</Text>
        <Text style={styles.subtitle}>Personalize Synapse freely — every option is included for everyone.</Text>

        <LivePreview />

        <Text style={styles.sectionLabel}>Theme</Text>
        <View style={[styles.themeGrid, { gap: THEME_GAP }]}>
          {themeRows.map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.themeRow, { gap: THEME_GAP }]}>
              {row.map((theme) => {
                const selected = active.theme === theme.id;
                return (
                  <Pressable
                    key={theme.id}
                    style={[styles.themeCard, selected && styles.themeCardSelected]}
                    onPressIn={() => {
                      updateAppearanceDraft({ theme: theme.id });
                      Haptics.selectionAsync();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${theme.label} theme`}
                  >
                    <ThemeMiniPreview themeId={theme.id} />
                    <Text style={styles.themeName}>{theme.label}</Text>
                  </Pressable>
                );
              })}
              {/* Keep a short last row aligned to the same column width. */}
              {Array.from({ length: previewCols - row.length }, (_, i) => (
                <View key={`pad-${i}`} style={{ flex: 1 }} />
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Accent Color</Text>
        <View style={styles.swatchRow}>
          {ACCENT_SWATCHES.map((swatch) => {
            const selected = active.accent === swatch.id;
            return (
              <Pressable
                key={swatch.id}
                onPress={() => {
                  updateAppearanceDraft({ accent: swatch.id as AccentId });
                  Haptics.selectionAsync();
                }}
                style={[styles.swatch, { backgroundColor: swatch.hex }, selected && styles.swatchSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${swatch.label} accent`}
              >
                {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
              </Pressable>
            );
          })}
        </View>

        {iconsSupported ? (
          <>
            <Text style={styles.sectionLabel}>App Icon</Text>
            <View style={styles.iconGrid}>
              {APP_ICON_OPTIONS.map((opt) => {
                const selected = pickedIcon === opt.id;
                const source = isDarkSurface && opt.dark ? opt.dark : opt.light;
                return (
                  <Pressable
                    key={opt.id}
                    style={[styles.iconCard, selected && styles.iconCardSelected]}
                    onPress={() => {
                      setPickedIcon(opt.id);
                      Haptics.selectionAsync();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${opt.label} app icon`}
                  >
                    <Image source={source} style={styles.iconImage} />
                    <Text style={styles.iconLabel}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.rowBody, { marginTop: 6 }]}>
              Applies when you tap Apply Appearance. iOS shows its own confirmation when the icon changes.
            </Text>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Wallpaper</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wallpaperRow}>
          {WALLPAPER_PRESETS.map((paper) => {
            const selected = active.wallpaper === paper.id;
            return (
              <Pressable
                key={paper.id}
                style={[styles.wallpaperCard, selected && styles.wallpaperCardSelected]}
                onPress={() => {
                  updateAppearanceDraft({ wallpaper: paper.id as WallpaperId, customWallpaperUri: null });
                  Haptics.selectionAsync();
                }}
              >
                <View
                  style={[
                    styles.wallpaperSwatch,
                    {
                      backgroundColor: paper.colors[0] || C.surfaceElevated,
                      borderColor: C.border,
                    },
                  ]}
                />
                <Text style={styles.wallpaperLabel}>{paper.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.wallpaperCard, active.wallpaper === "custom" && styles.wallpaperCardSelected]}
            onPress={pickCustomWallpaper}
          >
            <View style={[styles.wallpaperSwatch, { alignItems: "center", justifyContent: "center", borderColor: C.border }]}>
              <Ionicons name="image-outline" size={18} color={C.textSecondary} />
            </View>
            <Text style={styles.wallpaperLabel}>Custom</Text>
          </Pressable>
        </ScrollView>

        <Text style={styles.sectionLabel}>Surface Style</Text>
        <View style={styles.card}>
          {SURFACES.map((surface) => {
            const selected = active.surfaceStyle === surface.id;
            return (
              <Pressable
                key={surface.id}
                style={[styles.surfaceRow, selected && styles.surfaceRowSelected]}
                onPress={() => {
                  updateAppearanceDraft({ surfaceStyle: surface.id });
                  Haptics.selectionAsync();
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{surface.label}</Text>
                  <Text style={styles.rowBody}>{surface.body}</Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={22} color={C.tint} /> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Accessibility</Text>
        <View style={styles.card}>
          {(
            [
              ["reduceTransparency", "Reduce Transparency", "Prefer solid, readable surfaces"],
              ["reduceMotion", "Reduce Motion", "Limit decorative motion"],
              ["increasedContrast", "Increased Contrast", "Stronger borders and solid cards"],
            ] as const
          ).map(([key, label, body]) => (
            <View key={key} style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{label}</Text>
                <Text style={styles.rowBody}>{body}</Text>
              </View>
              <Switch
                value={!!active[key]}
                onValueChange={(v) => updateAppearanceDraft({ [key]: v })}
                trackColor={{ true: C.tintLight, false: C.border }}
                thumbColor={active[key] ? C.tint : C.surfaceElevated}
              />
            </View>
          ))}
          <Text style={[styles.rowBody, { marginTop: 8 }]}>
            System accessibility settings always take priority when enabled on your device.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Widget Appearance</Text>
        <View style={styles.chipRow}>
          {(
            [
              { id: "system" as const, label: "Match System" },
              { id: "light" as const, label: "Light" },
              { id: "dark" as const, label: "Dark" },
            ]
          ).map((opt) => (
            <Pressable
              key={opt.id}
              style={[styles.chip, active.widgetAppearance === opt.id && styles.chipActive]}
              onPress={() => updateAppearanceDraft({ widgetAppearance: opt.id })}
            >
              <Text style={[styles.chipText, active.widgetAppearance === opt.id && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Saved Looks</Text>
        <View style={styles.card}>
          <Text style={styles.rowBody}>Save a favorite combination of theme, accent, wallpaper, and surface.</Text>
          <View style={styles.saveRow}>
            <TextInput
              value={saveName}
              onChangeText={setSaveName}
              placeholder="Morning Calm"
              placeholderTextColor={C.textTertiary}
              style={styles.saveInput}
            />
            <Pressable
              style={styles.saveBtn}
              onPress={async () => {
                await saveCurrentLook(saveName);
                setSaveName("");
                Haptics.selectionAsync();
              }}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </View>
          {savedLooks.length === 0 ? (
            <Text style={[styles.rowBody, { marginTop: 10 }]}>No saved looks yet.</Text>
          ) : (
            savedLooks.map((look) => (
              <View key={look.id} style={styles.lookRow}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => {
                    applySavedLook(look);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={styles.rowTitle}>{look.name}</Text>
                  <Text style={styles.rowBody}>
                    {look.config.theme} · {look.config.accent} · {look.config.surfaceStyle}
                  </Text>
                </Pressable>
                <Pressable onPress={() => deleteSavedLook(look.id)} hitSlop={10} accessibilityLabel="Delete look">
                  <Ionicons name="trash-outline" size={18} color={C.textTertiary} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionLabel}>Reset Appearance</Text>
        <Pressable style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>Reset to Default</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={styles.secondaryBtn} onPress={handleCancel} disabled={busy}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={handleApply} disabled={busy}>
          <Text style={styles.primaryBtnText}>Apply Appearance</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ThemeMiniPreview({ themeId }: { themeId: ThemePreference }) {
  const { colors: live } = useTheme();
  const palette = previewPalette(themeId, live);
  return (
    <View style={[mini.wrap, { backgroundColor: palette.bg }]}>
      <View style={[mini.accentPill, { backgroundColor: palette.accent }]} />
      <View style={mini.blocksRow}>
        <View style={mini.block} />
        <View style={mini.block} />
      </View>
    </View>
  );
}

function previewPalette(themeId: ThemePreference, live: Theme) {
  switch (themeId) {
    case "dark":
      return { bg: "#171011", card: "rgba(255,250,247,0.12)", accent: "#D94A5C", muted: "#7F7773", border: "rgba(255,255,255,0.16)" };
    case "evergreen":
      return { bg: "#F7F8FA", card: "#FFFFFF", accent: "#477A70", muted: "#8A939A", border: "#E5E9EB" };
    case "calm":
      return { bg: "#F5ECE2", card: "rgba(255,250,244,0.9)", accent: "#A30D24", muted: "#958276", border: "rgba(0,0,0,0.08)" };
    case "blue":
      return { bg: "#EAF2FA", card: "#FFFFFF", accent: "#477BAF", muted: "#8A9DB0", border: "#D2E0EF" };
    case "system":
      return { bg: live.background, card: live.surface, accent: live.tint, muted: live.textTertiary, border: live.border };
    default:
      return { bg: "#F7F8FA", card: "#FFFFFF", accent: "#A30D24", muted: "#9A948D", border: "#E5E9EB" };
  }
}

function LivePreview() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.preview} accessibilityLabel="Live Synapse preview with demo data">
      <Text style={styles.previewEyebrow}>Live preview</Text>
      <Text style={styles.previewHello}>Good evening, Alex</Text>
      <View style={styles.previewCard}>
        <Text style={styles.previewCardTitle}>Medications</Text>
        <Text style={styles.previewCardBody}>Vitamin D · 1 of 2 doses today</Text>
      </View>
      <View style={styles.previewCard}>
        <Text style={styles.previewCardTitle}>Appointments</Text>
        <Text style={styles.previewCardBody}>Check-in · Tomorrow 10:30 AM</Text>
      </View>
      <View style={styles.previewRow}>
        <View style={[styles.previewMini, { flex: 1 }]}>
          <Text style={styles.previewCardTitle}>Feeling</Text>
          <Text style={styles.previewCardBody}>Steady</Text>
        </View>
        <View style={[styles.previewMini, { flex: 1 }]}>
          <Text style={styles.previewCardTitle}>Sick Mode</Text>
          <Text style={styles.previewCardBody}>Off</Text>
        </View>
      </View>
      <View style={styles.previewNav}>
        {["home", "heart", "add", "shield", "person"].map((icon, i) => (
          <Ionicons
            key={icon}
            name={(i === 0 ? "home" : i === 2 ? "add-circle" : `${icon}-outline`) as keyof typeof Ionicons.glyphMap}
            size={i === 2 ? 26 : 18}
            color={i === 0 ? C.tint : C.textTertiary}
          />
        ))}
      </View>
      <Text style={styles.previewNote}>Demo information only — not your real health data.</Text>
    </View>
  );
}

const mini = StyleSheet.create({
  wrap: {
    width: "100%",
    aspectRatio: 1.45,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingTop: 9,
    paddingBottom: 8,
    marginBottom: 8,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  accentPill: {
    height: 8,
    width: "42%",
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  blocksRow: {
    flexDirection: "row",
    gap: 8,
  },
  block: {
    flex: 1,
    height: 22,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
  },
});

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 20 },
    kicker: {
      fontWeight: "700",
      fontSize: 12,
      color: C.tint,
      letterSpacing: 0.3,
      marginBottom: 6,
    },
    title: { fontWeight: "800", fontSize: 28, color: C.text, letterSpacing: -0.4, marginBottom: 4 },
    subtitle: { fontWeight: "500", fontSize: 14, color: C.textSecondary, marginBottom: 18, lineHeight: 20 },
    sectionLabel: {
      fontWeight: "700",
      fontSize: 12,
      color: C.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 18,
    },
    themeGrid: {},
    themeRow: { flexDirection: "row" },
    themeCard: {
      flex: 1,
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 8,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: "center",
    },
    themeCardSelected: { borderColor: C.tint, borderWidth: 1.5 },
    themeName: { fontWeight: "700", fontSize: 13, color: C.text, textAlign: "center" },

    swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    swatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    swatchSelected: { borderColor: C.text },
    iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    iconCard: {
      width: "22%",
      alignItems: "center",
      gap: 6,
      padding: 6,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    iconCardSelected: { borderColor: C.tint, backgroundColor: C.surface },
    iconImage: { width: 56, height: 56, borderRadius: 13 },
    iconLabel: { fontWeight: "600", fontSize: 11, color: C.text },
    wallpaperRow: { gap: 10, paddingRight: 8 },
    wallpaperCard: {
      width: 84,
      borderRadius: 14,
      padding: 8,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      alignItems: "center",
      gap: 6,
    },
    wallpaperCardSelected: { borderColor: C.tint },
    wallpaperSwatch: { width: 64, height: 40, borderRadius: 10, borderWidth: 1 },
    wallpaperLabel: { fontWeight: "600", fontSize: 11, color: C.text },
    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: C.border,
      gap: 4,
      ...raised("sm"),
    },
    surfaceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    surfaceRowSelected: {},
    rowTitle: { fontWeight: "700", fontSize: 15, color: C.text },
    rowBody: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginTop: 2, lineHeight: 17 },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    chipActive: { borderColor: C.text, backgroundColor: C.surfaceElevated },
    chipText: { fontWeight: "700", fontSize: 13, color: C.textSecondary },
    chipTextActive: { color: C.text },
    saveRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    saveInput: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 12,
      color: C.text,
      backgroundColor: C.surfaceElevated,
    },
    saveBtn: {
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: C.tint,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtnText: { fontWeight: "700", fontSize: 14, color: "#fff" },
    lookRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      marginTop: 4,
    },
    resetBtn: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surface,
      marginBottom: 8,
    },
    resetBtnText: { fontWeight: "700", fontSize: 15, color: C.text },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      backgroundColor: C.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    secondaryBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surface,
    },
    secondaryBtnText: { fontWeight: "700", fontSize: 15, color: C.text },
    primaryBtn: {
      flex: 1.4,
      minHeight: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tint,
    },
    primaryBtnText: { fontWeight: "700", fontSize: 15, color: "#fff" },
    preview: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
      gap: 8,
      marginBottom: 8,
      ...raised("sm"),
    },
    previewEyebrow: {
      fontWeight: "700",
      fontSize: 11,
      color: C.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    previewHello: { fontWeight: "800", fontSize: 20, color: C.text, letterSpacing: -0.3 },
    previewCard: {
      backgroundColor: C.surfaceElevated,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    previewCardTitle: { fontWeight: "800", fontSize: 13, color: C.text },
    previewCardBody: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginTop: 2 },
    previewRow: { flexDirection: "row", gap: 8 },
    previewMini: {
      backgroundColor: C.surfaceElevated,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    previewNav: {
      marginTop: 4,
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
    },
    previewNote: { fontWeight: "500", fontSize: 11, color: C.textTertiary, marginTop: 2 },
  });
}

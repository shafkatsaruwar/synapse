import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { raised } from "@/constants/raised";
import type { DueDoseCandidate } from "@/lib/mark-due-taken";

export type MarkDueTakenSheetProps = {
  visible: boolean;
  candidates: DueDoseCandidate[];
  busy?: boolean;
  onClose: () => void;
  onConfirm: (selectedKeys: string[]) => void;
};

export default function MarkDueTakenSheet({
  visible,
  candidates,
  busy = false,
  onClose,
  onConfirm,
}: MarkDueTakenSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(candidates.map((c) => c.key)));
  const [confirmedTaken, setConfirmedTaken] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set(candidates.map((c) => c.key)));
    setConfirmedTaken(false);
  }, [visible, candidates]);

  const selectedCount = candidates.reduce((n, c) => n + (selected.has(c.key) ? 1 : 0), 0);
  const canConfirm = selectedCount > 0 && confirmedTaken && !busy;

  const toggleKey = (key: string) => {
    if (busy) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? undefined : onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Mark Due as Taken</Text>
          <Text style={styles.subtitle}>
            Only doses already due are listed. Upcoming and previously taken doses stay unchanged.
          </Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {candidates.map((dose) => {
              const isOn = selected.has(dose.key);
              return (
                <Pressable
                  key={dose.key}
                  style={[styles.row, isOn && styles.rowSelected]}
                  onPress={() => toggleKey(dose.key)}
                  disabled={busy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isOn }}
                  accessibilityLabel={`${dose.medicationName}, ${dose.amountLabel || "dose"}, ${dose.timeLabel}`}
                >
                  <View style={[styles.check, isOn && styles.checkOn]}>
                    {isOn ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {dose.emoji ? `${dose.emoji} ` : ""}
                      {dose.medicationName}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {[dose.amountLabel, dose.timeLabel].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            style={styles.confirmRow}
            onPress={() => !busy && setConfirmedTaken((v) => !v)}
            disabled={busy}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmedTaken }}
            accessibilityLabel="I took the selected doses"
          >
            <View style={[styles.check, confirmedTaken && styles.checkOn]}>
              {confirmedTaken ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
            </View>
            <Text style={styles.confirmText}>I took the selected dose{selectedCount === 1 ? "" : "s"}</Text>
          </Pressable>

          <Pressable
            style={[styles.primaryBtn, !canConfirm && styles.primaryBtnDisabled]}
            disabled={!canConfirm}
            onPress={() => onConfirm(candidates.filter((c) => selected.has(c.key)).map((c) => c.key))}
            accessibilityRole="button"
            accessibilityLabel={`Confirm ${selectedCount} due dose${selectedCount === 1 ? "" : "s"} as taken`}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {selectedCount === 0 ? "Select at least one dose" : `Mark ${selectedCount} as Taken`}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.cancelBtn}
            onPress={onClose}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      maxHeight: "88%",
      ...raised("lg"),
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      marginBottom: 14,
    },
    title: { fontSize: 22, fontWeight: "800", color: C.text, letterSpacing: -0.3 },
    subtitle: { fontSize: 14, color: C.textSecondary, lineHeight: 20, marginTop: 6, marginBottom: 14 },
    list: { maxHeight: 340 },
    listContent: { paddingBottom: 8, gap: 8 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
    },
    rowSelected: {
      borderColor: C.tint,
      backgroundColor: C.tintLight,
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surface,
    },
    checkOn: {
      borderColor: C.tint,
      backgroundColor: C.tint,
    },
    rowText: { flex: 1, minWidth: 0 },
    rowName: { fontSize: 16, fontWeight: "700", color: C.text },
    rowMeta: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
    confirmRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      marginTop: 8,
    },
    confirmText: { flex: 1, fontSize: 15, fontWeight: "600", color: C.text },
    primaryBtn: {
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: C.tint,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    primaryBtnDisabled: { opacity: 0.45 },
    primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    cancelBtn: { alignItems: "center", paddingVertical: 14 },
    cancelText: { fontSize: 15, fontWeight: "700", color: C.textSecondary },
  });
}

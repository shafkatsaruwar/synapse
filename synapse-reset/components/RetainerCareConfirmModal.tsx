/**
 * Final verification before marking retainers complete.
 * Opening the modal is never completion — only “Yes, confirmed” is.
 */
import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { modalOverlay, modalSurface } from "@/lib/modal-colors";

type Props = {
  visible: boolean;
  onConfirmYes: () => void;
  onNotYet: () => void;
  onPain: () => void;
  onClose: () => void;
};

export default function RetainerCareConfirmModal({
  visible,
  onConfirmYes,
  onNotYet,
  onPain,
  onClose,
}: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>Are both retainers fully seated and comfortable?</Text>
          <Text style={styles.body}>
            Only confirm when both are in place. Opening this check does not count as done.
          </Text>
          <Pressable
            style={[styles.btn, styles.primary]}
            onPress={onConfirmYes}
            accessibilityRole="button"
            accessibilityLabel="Yes, confirmed"
          >
            <Text style={styles.primaryText}>Yes, confirmed</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={onNotYet} accessibilityRole="button" accessibilityLabel="Not yet">
            <Text style={styles.btnText}>Not yet</Text>
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={onPain}
            accessibilityRole="button"
            accessibilityLabel="They hurt or don’t fit"
          >
            <Text style={styles.btnText}>They hurt or don’t fit</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.cancelText}>Close</Text>
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
      backgroundColor: modalOverlay(),
      justifyContent: "center",
      padding: 24,
    },
    card: {
      backgroundColor: modalSurface(C),
      borderRadius: 16,
      padding: 20,
      gap: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: C.text,
      lineHeight: 26,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: C.textSecondary,
      marginBottom: 4,
    },
    btn: {
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: C.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    primary: {
      backgroundColor: C.tint,
      borderColor: C.tint,
    },
    primaryText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
    btnText: {
      color: C.text,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
    cancel: {
      paddingVertical: 10,
      alignItems: "center",
    },
    cancelText: {
      color: C.textSecondary,
      fontSize: 15,
      fontWeight: "500",
    },
  });
}

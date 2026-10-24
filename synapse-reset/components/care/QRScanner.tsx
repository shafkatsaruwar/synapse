import React, { useRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "./ui";

/** Scans a QR code with the camera. Frames are processed on-device and never stored or uploaded. */
export default function QRScanner({ visible, onClose, onScanned }: { visible: boolean; onClose: () => void; onScanned: (text: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const handled = useRef(false);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} onShow={() => (handled.current = false)}>
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              if (handled.current) return;
              handled.current = true;
              onScanned(data);
            }}
          />
        ) : (
          <View style={styles.permission}>
            <Text style={styles.title}>Camera access</Text>
            <Text style={styles.body}>Synapse uses the camera only to read the QR code on the other person's phone. Nothing is saved or sent.</Text>
            {permission && !permission.canAskAgain ? (
              <Text style={styles.body}>Camera access is turned off. You can enable it in Settings, or close this and paste the invitation instead.</Text>
            ) : (
              <PrimaryButton label="Allow camera" onPress={() => void requestPermission()} />
            )}
          </View>
        )}
        <View style={[styles.frame, { top: insets.top + 90 }]} pointerEvents="none" />
        <Pressable style={[styles.close, { top: insets.top + 12 }]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close scanner">
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
        <Text style={[styles.hint, { bottom: insets.bottom + 40 }]}>Point at the invitation QR code</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  permission: { flex: 1, padding: 28, justifyContent: "center", gap: 14 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  body: { color: "#ddd", fontSize: 15, lineHeight: 22 },
  frame: { position: "absolute", alignSelf: "center", width: 250, height: 250, borderRadius: 24, borderWidth: 3, borderColor: "rgba(255,255,255,0.85)" },
  close: { position: "absolute", right: 16, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, minHeight: 44, justifyContent: "center" },
  closeText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  hint: { position: "absolute", alignSelf: "center", color: "#fff", fontWeight: "600", fontSize: 15 },
});

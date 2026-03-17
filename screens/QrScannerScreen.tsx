import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { parsePairingUrl, restoreFromPairingUrl } from "@/lib/qr-sync";

const C = Colors.dark;
const MAROON = "#800020";

interface QrScannerScreenProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function QrScannerScreen({ onSuccess, onCancel }: QrScannerScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!scanning || restoring) return;

    const parsed = parsePairingUrl(data);
    if (!parsed) {
      setError("Invalid QR code. Please scan the code shown on your iPhone.");
      return;
    }

    setScanning(false);
    setRestoring(true);
    setError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const { error: err } = await restoreFromPairingUrl(data);
    setRestoring(false);

    if (err) {
      setError(err.message || "Could not connect. Make sure both devices are on the same Wi‑Fi.");
      setScanning(true);
      return;
    }

    onSuccess();
  };

  const handleRetry = () => {
    setError(null);
    setScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!permission) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + 40 }]}>
        <ActivityIndicator size="large" color={MAROON} />
        <Text style={styles.hint}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + 40, paddingHorizontal: 24 }]}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.hint}>
          Synapse needs camera access to scan the QR code from your iPhone and restore your data.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Allow Camera</Text>
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 40 : insets.top + 16 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan to restore</Text>
        <Pressable style={styles.closeBtn} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel">
          <Ionicons name="close" size={24} color={C.text} />
        </Pressable>
      </View>

      <Text style={styles.instruction}>
        Point your camera at the QR code on your iPhone
      </Text>

      <View style={[styles.cameraWrap, { height: width - 48 }]}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanning && !restoring ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        />
      </View>

      {error && (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={handleRetry}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {restoring && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>Restoring your data…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: 24,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: C.text,
  },
  closeBtn: {
    padding: 8,
  },
  instruction: {
    fontSize: 16,
    color: C.textSecondary,
    marginBottom: 16,
  },
  cameraWrap: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  errorWrap: {
    marginTop: 16,
    padding: 16,
    backgroundColor: C.redLight,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 14,
    color: C.text,
    marginBottom: 12,
  },
  retryBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: C.red,
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  primaryBtn: {
    backgroundColor: MAROON,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 16,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  cancelBtnText: {
    color: C.textSecondary,
    fontSize: 16,
  },
  hint: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
    marginTop: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  overlayText: {
    color: "#fff",
    fontSize: 16,
  },
});

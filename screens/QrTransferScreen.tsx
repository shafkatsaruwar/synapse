import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import QRCode from "react-native-qrcode-svg";
import Colors from "@/constants/colors";
import {
  generatePairingToken,
  startTransferServer,
  stopTransferServer,
  isTransferServerSupported,
} from "@/lib/qr-sync";

const C = Colors.dark;
const MAROON = "#800020";

interface QrTransferScreenProps {
  visible: boolean;
  onClose: () => void;
}

export default function QrTransferScreen({ visible, onClose }: QrTransferScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!visible) return;

    if (!isTransferServerSupported()) {
      setError("Transfer is only available on iPhone and iPad.");
      setStarting(false);
      return;
    }

    setError(null);
    setPairingUrl(null);
    setStarting(true);

    const token = generatePairingToken();

    startTransferServer(token, (info) => {
      setPairingUrl(info.pairingUrl);
      setStarting(false);
    }).then(({ error: err }) => {
      if (err) {
        setError(err.message);
        setStarting(false);
      }
    });

    return () => {
      stopTransferServer();
    };
  }, [visible]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopTransferServer();
    onClose();
  };

  const qrSize = Math.min(width - 96, 280);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 40 : insets.top + 16 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Send data to iPad</Text>
          <Pressable
            style={styles.closeBtn}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={C.text} />
          </Pressable>
        </View>

        {starting && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={MAROON} />
            <Text style={styles.hint}>Starting transfer server…</Text>
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <View style={[styles.errorIcon, { backgroundColor: C.redLight }]}>
              <Ionicons name="alert-circle" size={32} color={C.red} />
            </View>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.primaryBtn} onPress={handleClose}>
              <Text style={styles.primaryBtnText}>Close</Text>
            </Pressable>
          </View>
        )}

        {pairingUrl && !error && (
          <View style={styles.content}>
            <View style={[styles.qrWrap, { width: qrSize + 24, height: qrSize + 24 }]}>
              <QRCode value={pairingUrl} size={qrSize} color="#1A1A1A" backgroundColor="#FFFFFF" />
            </View>
            <Text style={styles.instruction}>
              Open Synapse on your iPad, go to setup, and scan this code
            </Text>
            <Text style={styles.hint}>Make sure both devices are on the same Wi‑Fi network.</Text>
            <Pressable style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: C.text,
  },
  closeBtn: {
    padding: 8,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingTop: 24,
  },
  qrWrap: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  instruction: {
    fontSize: 16,
    color: C.text,
    textAlign: "center",
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 16,
    color: C.text,
    textAlign: "center",
    marginHorizontal: 24,
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
  },
  cancelBtnText: {
    color: C.textSecondary,
    fontSize: 16,
  },
});

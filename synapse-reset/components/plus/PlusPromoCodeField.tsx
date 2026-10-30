import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { usePlus } from "@/contexts/PlusContext";

type Props = {
  /** Compact layout for settings rows. */
  compact?: boolean;
};

export default function PlusPromoCodeField({ compact = false }: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { redeemPromoCode, entitlement, hasPlus } = usePlus();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageOk, setMessageOk] = useState(false);

  const alreadyLifetime =
    hasPlus &&
    (entitlement.source === "lifetime" || entitlement.source === "promo_lifetime");

  const onRedeem = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await redeemPromoCode(code);
      setMessageOk(result.ok);
      setMessage(result.message);
      if (result.ok) {
        setCode("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  };

  if (alreadyLifetime && entitlement.source === "promo_lifetime") {
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        <Text style={styles.label}>Promotional access</Text>
        <Text style={styles.hint}>Lifetime Synapse Plus is unlocked on this device.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={styles.label}>Have a promo code?</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Enter code"
          placeholderTextColor={C.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          editable={!busy}
          accessibilityLabel="Promotional code"
          onSubmitEditing={() => {
            void onRedeem();
          }}
          returnKeyType="done"
        />
        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={() => {
            void onRedeem();
          }}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Redeem promotional code"
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Redeem</Text>
          )}
        </Pressable>
      </View>
      {message ? (
        <Text style={[styles.message, messageOk ? styles.messageOk : styles.messageErr]}>
          {message}
        </Text>
      ) : (
        <Text style={styles.hint}>Holiday and special offers unlock lifetime access on this device.</Text>
      )}
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    wrap: { marginBottom: 16, gap: 8 },
    wrapCompact: { marginBottom: 12 },
    label: { fontSize: 14, fontWeight: "700", color: C.text },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    input: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      backgroundColor: C.surface,
      paddingHorizontal: 14,
      fontSize: 16,
      color: C.text,
    },
    button: {
      minHeight: 48,
      minWidth: 96,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: C.tint,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonDisabled: { opacity: 0.55 },
    buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
    hint: { fontSize: 12, lineHeight: 17, color: C.textTertiary },
    message: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
    messageOk: { color: C.green },
    messageErr: { color: C.red },
  });
}

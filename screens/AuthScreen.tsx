import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

const C = Colors.dark;
const MAROON = "#800020";

type Mode = "signin" | "signup" | "forgot";

interface AuthScreenProps {
  onBack: () => void;
  onSuccess?: () => void;
}

export default function AuthScreen({ onBack, onSuccess }: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, signOut, resetPassword } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setMessage({ type: "error", text: "Enter email and password." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSuccess?.();
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      setMessage({ type: "error", text: "Enter email and password." });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await signUp(email.trim(), password, firstName.trim() ? { first_name: firstName.trim() } : undefined);
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMessage({ type: "success", text: "Check your email to confirm your account." });
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setMessage({ type: "error", text: "Enter your email." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await resetPassword(email.trim());
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMessage({ type: "success", text: "Check your email for the reset link." });
  };

  const topPad = Platform.OS === "web" ? 24 : insets.top + 8;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={20}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button" accessibilityLabel="Back to Settings">
          <Ionicons name="arrow-back" size={22} color={C.text} />
          <Text style={styles.backText}>Settings</Text>
        </Pressable>

        <Text style={styles.title}>{mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password"}</Text>
        <Text style={styles.subtitle}>
          {mode === "signin" && "Sign in to back up and restore your data."}
          {mode === "signup" && "Create an account to enable secure cloud backup."}
          {mode === "forgot" && "Enter your email and we'll send a reset link."}
        </Text>

        <View style={styles.card}>
          {message && (
            <View style={[styles.messageBox, message.type === "error" ? styles.messageError : styles.messageSuccess]}>
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          )}

          {mode === "signup" && (
            <>
              <Text style={styles.label}>First name (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor={C.textTertiary}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={C.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {mode !== "forgot" && (
            <>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder={mode === "signup" ? "At least 6 characters" : "Password"}
                placeholderTextColor={C.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </>
          )}

          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="small" color={MAROON} />
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.9 : 1 }]}
              onPress={mode === "signin" ? handleSignIn : mode === "signup" ? handleSignUp : handleForgotPassword}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>
                {mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.links}>
          {mode === "signin" && (
            <>
              <Pressable onPress={() => { setMode("forgot"); setMessage(null); }}>
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
              <Pressable onPress={() => { setMode("signup"); setMessage(null); }}>
                <Text style={styles.linkText}>Create an account</Text>
              </Pressable>
            </>
          )}
          {mode === "signup" && (
            <Pressable onPress={() => { setMode("signin"); setMessage(null); }}>
              <Text style={styles.linkText}>Already have an account? Sign in</Text>
            </Pressable>
          )}
          {mode === "forgot" && (
            <Pressable onPress={() => { setMode("signin"); setMessage(null); }}>
              <Text style={styles.linkText}>Back to sign in</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { paddingHorizontal: 24 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  backText: { fontWeight: "600", fontSize: 15, color: C.text },
  title: { fontWeight: "700", fontSize: 26, color: C.text, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginBottom: 24, lineHeight: 20 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  input: { fontWeight: "400", fontSize: 15, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  messageBox: { marginBottom: 14, padding: 12, borderRadius: 10 },
  messageError: { backgroundColor: C.redLight },
  messageSuccess: { backgroundColor: Colors.dark.greenLight },
  messageText: { fontWeight: "500", fontSize: 13, color: C.text },
  loaderWrap: { paddingVertical: 14, alignItems: "center" },
  primaryBtn: { backgroundColor: MAROON, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { fontWeight: "600", fontSize: 16, color: "#fff" },
  links: { gap: 12 },
  linkText: { fontWeight: "500", fontSize: 14, color: C.tint },
});

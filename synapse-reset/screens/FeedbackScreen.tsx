import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import TextInput from "@/components/DoneTextInput";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  feedbackStorage,
  type FeedbackCategory,
  type FeedbackSentiment,
} from "@/lib/storage-self";

type FeedbackScreenProps = {
  onBack?: () => void;
  initialSentiment?: FeedbackSentiment | null;
  onFinished?: () => void;
};

type ScreenMode = "choice" | "positive" | "negative" | "submitted";

const CATEGORY_OPTIONS: { id: FeedbackCategory; label: string }[] = [
  { id: "bug", label: "Bug" },
  { id: "feature_request", label: "Feature request" },
  { id: "something_confusing", label: "Something confusing" },
  { id: "general_feedback", label: "General feedback" },
];

export default function FeedbackScreen({
  onBack,
  initialSentiment,
  onFinished,
}: FeedbackScreenProps) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [mode, setMode] = useState<ScreenMode>("choice");
  const [category, setCategory] = useState<FeedbackCategory | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialSentiment === "positive") {
      setMode("positive");
      return;
    }
    if (initialSentiment === "needs_improvement") {
      setMode("negative");
      return;
    }
    setMode("choice");
  }, [initialSentiment]);

  const submitFeedback = async () => {
    if (saving) return;
    if (!message.trim()) {
      Alert.alert("Add a little more detail", "A quick note helps us understand your experience.");
      return;
    }

    setSaving(true);
    try {
      await feedbackStorage.save({
        sentiment: mode === "positive" ? "positive" : "needs_improvement",
        category: mode === "positive" ? undefined : category,
        message: message.trim(),
        email: email.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMode("submitted");
      onFinished?.();
    } catch {
      Alert.alert("Couldn't save feedback", "Please try again. Your note is still here.");
    } finally {
      setSaving(false);
    }
  };

  const renderChoice = () => (
    <View style={styles.section}>
      <Text style={styles.question}>How’s Synapse working for you?</Text>
      <View style={styles.choiceStack}>
        <Pressable
          style={({ pressed }) => [styles.choiceCard, pressed && styles.choiceCardPressed]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setMode("positive");
          }}
        >
          <View style={[styles.choiceIconWrap, { backgroundColor: C.greenLight }]}>
            <Ionicons name="heart-outline" size={22} color={C.green} />
          </View>
          <View style={styles.choiceTextWrap}>
            <Text style={styles.choiceTitle}>I’m enjoying it</Text>
            <Text style={styles.choiceBody}>Tell us what’s working well.</Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.choiceCard, pressed && styles.choiceCardPressed]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setMode("negative");
          }}
        >
          <View style={[styles.choiceIconWrap, { backgroundColor: C.orangeLight }]}>
            <Ionicons name="construct-outline" size={22} color={C.orange} />
          </View>
          <View style={styles.choiceTextWrap}>
            <Text style={styles.choiceTitle}>Needs improvement</Text>
            <Text style={styles.choiceBody}>Tell us what could be better.</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );

  const renderFeedbackForm = () => (
    <View style={styles.section}>
      <Text style={styles.question}>{mode === "positive" ? "What are you enjoying?" : "What could be better?"}</Text>
      <Text style={styles.bodyCopy}>Your feedback is saved on this device. Please leave out personal health details.</Text>

      {mode === "negative" ? <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Feedback category</Text>
        <View style={styles.categoryWrap}>
          {CATEGORY_OPTIONS.map((option) => {
            const active = category === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setCategory(active ? undefined : option.id);
                }}
              >
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View> : null}

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Feedback</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={message}
          onChangeText={setMessage}
          placeholder={mode === "positive" ? "Tell us what’s working well" : "What could be better?"}
          placeholderTextColor={C.textTertiary}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Email (optional)</Text>
        <Text style={styles.bodyCopy}>Saved with your note; this does not send a message.</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email (optional)"
          placeholderTextColor={C.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.choiceCardPressed]}
          onPress={() => setMode("choice")}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, (!message.trim() || saving) && styles.buttonDisabled]}
          onPress={submitFeedback}
          disabled={!message.trim() || saving}
        >
          <Text style={styles.primaryButtonText}>{saving ? "Saving…" : "Submit"}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderSubmitted = () => (
    <View style={styles.section}>
      <View style={styles.thankYouWrap}>
        <View style={[styles.choiceIconWrap, { backgroundColor: C.tintLight }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={C.tint} />
        </View>
        <Text style={styles.question}>Thanks. Your feedback is saved.</Text>
        <Text style={styles.bodyCopy}>
          Your note is stored on this device. Thanks for taking the time to share your experience.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
        onPress={onBack}
      >
        <Text style={styles.primaryButtonText}>Done</Text>
      </Pressable>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Help improve Synapse</Text>
          <Text style={styles.subtitle}>Your feedback helps make the app better.</Text>
        </View>
        {onBack ? (
          <Pressable style={styles.closeButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Close feedback" hitSlop={4}>
            <Ionicons name="close" size={22} color={C.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {mode === "choice" ? renderChoice() : null}
      {mode === "positive" || mode === "negative" ? renderFeedbackForm() : null}
      {mode === "submitted" ? renderSubmitted() : null}
    </ScrollView>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "transparent",
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 120,
      gap: 14,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    headerCopy: {
      flex: 1,
      gap: 8,
    },
    title: {
      fontSize: 26,
      lineHeight: 32,
      fontWeight: "800",
      color: C.text,
      letterSpacing: -0.7,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: C.textSecondary,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    section: {
      backgroundColor: C.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: C.borderLight,
      padding: 16,
      gap: 14,
    },
    question: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: "800",
      color: C.text,
      letterSpacing: -0.6,
    },
    bodyCopy: {
      fontSize: 16,
      lineHeight: 23,
      color: C.textSecondary,
    },
    choiceStack: {
      gap: 14,
    },
    choiceCard: {
      flexDirection: "row",
      gap: 14,
      alignItems: "flex-start",
      backgroundColor: C.surfaceElevated,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: C.borderLight,
      padding: 12,
    },
    choiceCardPressed: {
      opacity: 0.92,
    },
    choiceIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    choiceTextWrap: {
      flex: 1,
      gap: 6,
    },
    choiceTitle: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "700",
      color: C.text,
    },
    choiceBody: {
      fontSize: 15,
      lineHeight: 22,
      color: C.textSecondary,
    },
    thankYouWrap: {
      gap: 12,
      alignItems: "flex-start",
    },
    fieldGroup: {
      gap: 10,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: C.textSecondary,
    },
    categoryWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
    },
    categoryChipActive: {
      borderColor: C.accent,
      backgroundColor: C.accentLight,
    },
    categoryChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: C.textSecondary,
    },
    categoryChipTextActive: {
      color: C.accent,
    },
    input: {
      minHeight: 48,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.borderLight,
      backgroundColor: C.surfaceElevated,
      color: C.text,
      fontSize: 17,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    textArea: {
      minHeight: 110,
    },
    actionRow: {
      flexDirection: "row",
      gap: 12,
      paddingTop: 4,
    },
    primaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 18,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    primaryButtonPressed: {
      opacity: 0.92,
    },
    primaryButtonText: {
      fontSize: 17,
      fontWeight: "700",
      color: "#FFF",
    },
    secondaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 18,
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.borderLight,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    secondaryButtonText: {
      fontSize: 17,
      fontWeight: "700",
      color: C.text,
    },
    buttonDisabled: {
      opacity: 0.55,
    },
  });
}


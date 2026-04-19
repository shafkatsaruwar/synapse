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
} from "@/lib/storage";
import { requestSynapseReview } from "@/lib/review-prompt";

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

  const submitNeedsImprovement = async () => {
    if (!message.trim()) {
      Alert.alert("Add a little more detail", "A quick note helps us understand what needs work.");
      return;
    }

    setSaving(true);
    try {
      await feedbackStorage.save({
        sentiment: "needs_improvement",
        category,
        message: message.trim(),
        email: email.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMode("submitted");
      onFinished?.();
    } finally {
      setSaving(false);
    }
  };

  const handleRateSynapse = async () => {
    setSaving(true);
    try {
      await feedbackStorage.save({
        sentiment: "positive",
        message: "",
        email: "",
      });
      const result = await requestSynapseReview();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onFinished?.();

      if (result === "unavailable") {
        Alert.alert(
          "Thanks for the love",
          "We saved your positive feedback. App Store rating isn't available in this build yet, but we still appreciate it."
        );
      }
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
            <Text style={styles.choiceBody}>Things feel smooth, helpful, and worth keeping around.</Text>
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
            <Text style={styles.choiceBody}>Tell us what feels off, confusing, or not pulling its weight.</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );

  const renderPositive = () => (
    <View style={styles.section}>
      <View style={styles.thankYouWrap}>
        <View style={[styles.choiceIconWrap, { backgroundColor: C.greenLight }]}>
          <Ionicons name="sparkles-outline" size={24} color={C.green} />
        </View>
        <Text style={styles.question}>Thanks for sticking with Synapse.</Text>
        <Text style={styles.bodyCopy}>
          If it’s helping, a quick App Store rating goes a long way. No pressure, just real support.
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.choiceCardPressed]}
          onPress={onBack}
        >
          <Text style={styles.secondaryButtonText}>Maybe later</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, saving && styles.buttonDisabled]}
          onPress={handleRateSynapse}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>{saving ? "Opening…" : "Rate Synapse"}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderNegative = () => (
    <View style={styles.section}>
      <Text style={styles.question}>What could be better?</Text>
      <Text style={styles.bodyCopy}>We keep this local-first and calm on purpose. Say what’s not landing.</Text>

      <View style={styles.fieldGroup}>
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
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Feedback</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={message}
          onChangeText={setMessage}
          placeholder="What could be better?"
          placeholderTextColor={C.textTertiary}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Email (optional)</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email (optional, if you'd like a response)"
          placeholderTextColor={C.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.choiceCardPressed]}
          onPress={onBack}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, (!message.trim() || saving) && styles.buttonDisabled]}
          onPress={submitNeedsImprovement}
          disabled={!message.trim() || saving}
        >
          <Text style={styles.primaryButtonText}>{saving ? "Sending…" : "Submit"}</Text>
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
        <Text style={styles.question}>Thanks. We’ve got it.</Text>
        <Text style={styles.bodyCopy}>
          We appreciate the honesty. Synapse gets better when people tell us what’s actually getting in the way.
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
          <Pressable style={styles.closeButton} onPress={onBack}>
            <Ionicons name="close" size={22} color={C.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {mode === "choice" ? renderChoice() : null}
      {mode === "positive" ? renderPositive() : null}
      {mode === "negative" ? renderNegative() : null}
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
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 120,
      gap: 18,
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
      fontSize: 34,
      lineHeight: 40,
      fontWeight: "800",
      color: C.text,
      letterSpacing: -0.7,
    },
    subtitle: {
      fontSize: 18,
      lineHeight: 25,
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
      padding: 20,
      gap: 18,
    },
    question: {
      fontSize: 28,
      lineHeight: 34,
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
      padding: 18,
    },
    choiceCardPressed: {
      opacity: 0.92,
    },
    choiceIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    choiceTextWrap: {
      flex: 1,
      gap: 6,
    },
    choiceTitle: {
      fontSize: 20,
      lineHeight: 25,
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
      minHeight: 58,
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
      minHeight: 140,
    },
    actionRow: {
      flexDirection: "row",
      gap: 12,
      paddingTop: 4,
    },
    primaryButton: {
      flex: 1,
      minHeight: 54,
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
      minHeight: 54,
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

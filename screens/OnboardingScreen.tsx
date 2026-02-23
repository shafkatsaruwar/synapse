import React, { useState, useRef } from "react";
import {
  StyleSheet, Text, View, Pressable, TextInput, ScrollView, Platform,
  useWindowDimensions, Animated, KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import Colors from "@/constants/colors";
import { settingsStorage, medicationStorage, type Medication } from "@/lib/storage";

const C = Colors.dark;
const TOTAL_STEPS = 9;

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface OnboardingMed {
  name: string;
  dosage: string;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [userName, setUserName] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState("");
  const [meds, setMeds] = useState<OnboardingMed[]>([]);
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const animateTransition = (next: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  };

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) animateTransition(step + 1);
  };

  const addCondition = () => {
    const trimmed = conditionInput.trim();
    if (trimmed && !conditions.includes(trimmed)) {
      setConditions([...conditions, trimmed]);
      setConditionInput("");
    }
  };

  const removeCondition = (c: string) => {
    setConditions(conditions.filter(x => x !== c));
  };

  const addMed = () => {
    const n = medName.trim();
    const d = medDosage.trim();
    if (n) {
      setMeds([...meds, { name: n, dosage: d || "as prescribed" }]);
      setMedName("");
      setMedDosage("");
    }
  };

  const removeMed = (i: number) => {
    setMeds(meds.filter((_, idx) => idx !== i));
  };

  const handleFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const settings = await settingsStorage.get();
    await settingsStorage.save({
      ...settings,
      name: userName.trim(),
      conditions,
      onboardingCompleted: true,
    });

    for (const m of meds) {
      const med: Medication = {
        id: Crypto.randomUUID(),
        name: m.name,
        dosage: m.dosage,
        frequency: "Daily",
        timeTag: "Morning",
        active: true,
        doses: 1,
      };
      await medicationStorage.add(med);
    }

    onComplete();
  };

  const renderDots = () => (
    <View style={styles.dots}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
      ))}
    </View>
  );

  const renderWelcome = () => (
    <View style={styles.centerContent}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoEmoji}>🌿</Text>
      </View>
      <Text style={styles.welcomeTitle}>Hello, I am Fir,{"\n"}your personal{"\n"}healthcare assistant</Text>
      <Text style={styles.welcomeSub}>Built for people who manage{"\n"}chronic conditions every day.</Text>
    </View>
  );

  const renderName = () => (
    <KeyboardAvoidingView style={styles.centerContent} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.stepTitle}>What should I call you?</Text>
      <TextInput
        style={styles.nameInput}
        placeholder="Your name"
        placeholderTextColor={C.textTertiary}
        value={userName}
        onChangeText={setUserName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={goNext}
      />
      <Text style={styles.inputHint}>This stays on your device only.</Text>
    </KeyboardAvoidingView>
  );

  const renderHealthSetup = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.setupContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Your health setup</Text>
      <Text style={styles.setupSub}>Add your medications and conditions.{"\n"}You can always change these later.</Text>

      <Text style={styles.setupLabel}>Medications</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.setupInput, { flex: 2 }]}
          placeholder="Medication name"
          placeholderTextColor={C.textTertiary}
          value={medName}
          onChangeText={setMedName}
        />
        <TextInput
          style={[styles.setupInput, { flex: 1 }]}
          placeholder="Dosage"
          placeholderTextColor={C.textTertiary}
          value={medDosage}
          onChangeText={setMedDosage}
        />
        <Pressable style={[styles.addBtn, !medName.trim() && { opacity: 0.3 }]} onPress={addMed} disabled={!medName.trim()}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>
      {meds.map((m, i) => (
        <View key={i} style={styles.chipRow}>
          <View style={styles.medChip}>
            <Text style={styles.medChipText}>💊 {m.name}</Text>
            <Text style={styles.medChipDose}>{m.dosage}</Text>
          </View>
          <Pressable onPress={() => removeMed(i)} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={C.textTertiary} />
          </Pressable>
        </View>
      ))}

      <Text style={[styles.setupLabel, { marginTop: 28 }]}>Medical Conditions</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.setupInput, { flex: 1 }]}
          placeholder="e.g. Adrenal Insufficiency"
          placeholderTextColor={C.textTertiary}
          value={conditionInput}
          onChangeText={setConditionInput}
          onSubmitEditing={addCondition}
          returnKeyType="done"
        />
        <Pressable style={[styles.addBtn, !conditionInput.trim() && { opacity: 0.3 }]} onPress={addCondition} disabled={!conditionInput.trim()}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>
      <View style={styles.chipsWrap}>
        {conditions.map(c => (
          <Pressable key={c} style={styles.condChip} onPress={() => removeCondition(c)}>
            <Text style={styles.condChipText}>{c}</Text>
            <Ionicons name="close" size={14} color={C.textSecondary} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  const renderStory = (content: React.ReactNode, buttonLabel?: string) => (
    <View style={styles.storyContent}>
      {content}
      {buttonLabel && step === TOTAL_STEPS - 1 && null}
    </View>
  );

  const storyScreens: { content: React.ReactNode; button: string }[] = [
    {
      content: (
        <View style={styles.storyContent}>
          <Text style={styles.storyText}>
            The app you are about to use{"\n"}was built for survival.
          </Text>
        </View>
      ),
      button: "Continue",
    },
    {
      content: (
        <View style={styles.storyContent}>
          <Text style={styles.storyText}>
            I was born with conditions{"\n"}that require lifelong medication.
          </Text>
          <Text style={[styles.storyText, { marginTop: 24 }]}>
            Missing a dose is not small.{"\n"}It is dangerous.
          </Text>
        </View>
      ),
      button: "Continue",
    },
    {
      content: (
        <View style={styles.storyContent}>
          <Text style={styles.storyText}>
            Every day is timing.{"\n"}Every illness is a risk.{"\n"}Every symptom is a decision.
          </Text>
          <Text style={[styles.storyText, { marginTop: 24, color: C.textSecondary }]}>
            This is not fitness.{"\n"}This is stability.
          </Text>
        </View>
      ),
      button: "Continue",
    },
    {
      content: (
        <View style={styles.storyContent}>
          <Text style={styles.storyText}>Most health apps track steps.</Text>
          <Text style={[styles.storyText, { marginTop: 24 }]}>
            I needed something{"\n"}that tracks life-saving routines.
          </Text>
          <Text style={[styles.storyText, { marginTop: 24, color: C.tint }]}>
            So I built it.
          </Text>
        </View>
      ),
      button: "Continue",
    },
    {
      content: (
        <View style={styles.storyContent}>
          <Text style={styles.storyTextSmall}>This app understands:</Text>
          <View style={styles.storyList}>
            <Text style={styles.storyListItem}>💊  Medications that cannot be late</Text>
            <Text style={styles.storyListItem}>🌡  Sick days that change everything</Text>
            <Text style={styles.storyListItem}>🧠  Brain fog and fatigue</Text>
            <Text style={styles.storyListItem}>🩺  The need for structure</Text>
          </View>
          <Text style={[styles.storyTextSmall, { marginTop: 24, color: C.textSecondary }]}>Because I live it.</Text>
        </View>
      ),
      button: "Continue",
    },
    {
      content: (
        <View style={styles.storyContent}>
          <Text style={styles.storyText}>Fir is not just an app.</Text>
          <Text style={[styles.storyText, { marginTop: 24 }]}>
            It is the system{"\n"}I depend on every day.
          </Text>
          <View style={styles.storyDivider} />
          <Text style={styles.storyTextSmall}>
            Built by a patient.{"\n"}For patients who cannot afford mistakes.
          </Text>
        </View>
      ),
      button: "Enter Fir",
    },
  ];

  const isStoryStep = step >= 3;
  const storyIndex = step - 3;

  const canContinue = () => {
    if (step === 1) return userName.trim().length > 0;
    return true;
  };

  const handleContinue = () => {
    if (step === TOTAL_STEPS - 1) {
      handleFinish();
    } else {
      goNext();
    }
  };

  const getButtonLabel = () => {
    if (step === 0) return "Continue";
    if (step === 1) return "Continue";
    if (step === 2) return "Continue";
    if (isStoryStep) return storyScreens[storyIndex].button;
    return "Continue";
  };

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
        {step === 0 && renderWelcome()}
        {step === 1 && renderName()}
        {step === 2 && renderHealthSetup()}
        {isStoryStep && storyScreens[storyIndex].content}
      </Animated.View>

      <View style={styles.footer}>
        {renderDots()}
        <Pressable
          style={[styles.continueBtn, !canContinue() && { opacity: 0.35 }]}
          onPress={handleContinue}
          disabled={!canContinue()}
        >
          <Text style={styles.continueBtnText}>{getButtonLabel()}</Text>
          {step < TOTAL_STEPS - 1 && <Ionicons name="arrow-forward" size={18} color="#fff" />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 28 },
  body: { flex: 1, justifyContent: "center" },
  footer: { gap: 16, paddingBottom: 8 },

  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)" },
  dotActive: { backgroundColor: C.text, width: 10, height: 10, borderRadius: 5 },
  dotDone: { backgroundColor: "rgba(255,255,255,0.3)" },

  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(48,209,88,0.12)",
    alignItems: "center", justifyContent: "center", marginBottom: 32,
  },
  logoEmoji: { fontSize: 36 },
  welcomeTitle: {
    fontFamily: "Inter_700Bold", fontSize: 28, color: C.text,
    textAlign: "center", lineHeight: 38, letterSpacing: -0.5,
  },
  welcomeSub: {
    fontFamily: "Inter_400Regular", fontSize: 15, color: C.textSecondary,
    textAlign: "center", marginTop: 16, lineHeight: 22,
  },

  stepTitle: {
    fontFamily: "Inter_700Bold", fontSize: 26, color: C.text,
    textAlign: "center", letterSpacing: -0.5, marginBottom: 24,
  },
  nameInput: {
    fontFamily: "Inter_500Medium", fontSize: 20, color: C.text, textAlign: "center",
    borderBottomWidth: 2, borderBottomColor: C.tint, paddingVertical: 12,
    width: "100%", maxWidth: 280,
  },
  inputHint: {
    fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary,
    marginTop: 12, textAlign: "center",
  },

  setupContent: { paddingTop: 8, paddingBottom: 40 },
  setupSub: {
    fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary,
    textAlign: "center", lineHeight: 20, marginBottom: 28,
  },
  setupLabel: {
    fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
  },
  inputRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  setupInput: {
    fontFamily: "Inter_400Regular", fontSize: 15, color: C.text,
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  addBtn: {
    width: 48, borderRadius: 12, backgroundColor: C.tint,
    alignItems: "center", justifyContent: "center",
  },
  chipRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginBottom: 8,
  },
  medChip: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: C.border,
  },
  medChipText: { fontFamily: "Inter_500Medium", fontSize: 15, color: C.text },
  medChipDose: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  condChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: C.border,
  },
  condChipText: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.text },

  storyContent: { flex: 1, justifyContent: "center", paddingHorizontal: 4 },
  storyText: {
    fontFamily: "Inter_600SemiBold", fontSize: 24, color: C.text,
    lineHeight: 34, letterSpacing: -0.3,
  },
  storyTextSmall: {
    fontFamily: "Inter_500Medium", fontSize: 18, color: C.text,
    lineHeight: 26,
  },
  storyList: { marginTop: 20, gap: 16 },
  storyListItem: {
    fontFamily: "Inter_500Medium", fontSize: 17, color: C.text, lineHeight: 24,
  },
  storyDivider: {
    width: 40, height: 2, backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 24,
  },

  continueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.tint, borderRadius: 14, paddingVertical: 16,
  },
  continueBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
});

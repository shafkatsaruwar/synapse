import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet, Text, View, Pressable, TextInput, ScrollView, Platform,
  useWindowDimensions, Animated, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { settingsStorage, medicationStorage } from "@/lib/storage";

const brainLogo = require("../assets/images/brain-logo.jpeg");

const C = Colors.dark;

const MAROON = "#800020";
const MAROON_LIGHT = "rgba(128,0,32,0.12)";

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface OnboardingMed {
  name: string;
  dosage: string;
}

function AnimatedLine({ text, delay, style, color }: { text: string; delay: number; style?: any; color?: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Animated.Text style={[style, { opacity, transform: [{ translateY }], color: color || style?.color || C.text }]}>
      {text}
    </Animated.Text>
  );
}

function AnimatedView({ delay, children, style }: { delay: number; children: React.ReactNode; style?: any }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function GlowDot({ active, done }: { active: boolean; done: boolean }) {
  const scale = useRef(new Animated.Value(active ? 1 : 0.7)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      Animated.timing(scale, { toValue: 0.7, duration: 200, useNativeDriver: true }).start();
      glowOpacity.setValue(0);
    }
  }, [active]);

  return (
    <View style={styles.dotContainer}>
      {active && (
        <Animated.View style={[styles.dotGlow, { opacity: glowOpacity }]} />
      )}
      <Animated.View
        style={[
          styles.dot,
          done && styles.dotDone,
          active && styles.dotActive,
          { transform: [{ scale }] },
        ]}
      />
    </View>
  );
}

const TOTAL_STEPS = 12;

const founderImage = require("../assets/images/founder.png");

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const [userName, setUserName] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState("");
  const [meds, setMeds] = useState<OnboardingMed[]>([]);
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [showMedFields, setShowMedFields] = useState(false);
  const [showCondFields, setShowCondFields] = useState(false);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const completionScale = useRef(new Animated.Value(0)).current;
  const completionOpacity = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  useEffect(() => {
    if (step === 9) {
      const t = setTimeout(() => setShowMedFields(true), 600);
      return () => clearTimeout(t);
    }
    if (step === 10) {
      const t = setTimeout(() => setShowCondFields(true), 600);
      return () => clearTimeout(t);
    }
    if (step === 11) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(completionScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
          Animated.timing(completionOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
        Animated.delay(400),
        Animated.timing(checkOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [step]);

  const animateTransition = (next: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(screenOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setStep(next);
      setAnimKey(k => k + 1);
      setShowMedFields(false);
      setShowCondFields(false);
      screenOpacity.setValue(0);
      Animated.timing(screenOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      await medicationStorage.save({
        name: m.name,
        dosage: m.dosage,
        frequency: "Daily",
        timeTag: "Morning",
        active: true,
        doses: 1,
      });
    }
    onComplete();
  };

  const canContinue = () => {
    if (step === 8) return userName.trim().length > 0;
    return true;
  };

  const getButtonLabel = () => {
    if (step === 11) return "Wanna See Where This Takes Us?";
    return "Continue";
  };

  const handleContinue = () => {
    if (step === 11) {
      handleFinish();
    } else {
      goNext();
    }
  };

  const renderDots = () => (
    <View style={styles.dotsRow}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <GlowDot key={i} active={i === step} done={i < step} />
      ))}
    </View>
  );

  const renderWelcome = () => (
    <View style={styles.welcomeCenter} key={animKey}>
      <AnimatedView delay={0}>
        <Image source={brainLogo} style={styles.brainLogo} />
      </AnimatedView>
      <AnimatedLine text="Synapse" delay={400} style={styles.welcomeTitle} color={C.text} />
      <AnimatedLine text="Built by a real patient, for real patients" delay={800} style={styles.welcomeSub} color={C.textSecondary} />
    </View>
  );

  const renderFounderIntro = () => (
    <View style={styles.storyCenter} key={animKey}>
      <AnimatedView delay={0}>
        <View style={styles.photoCircle}>
          <Image source={founderImage} style={styles.photoImage} />
        </View>
      </AnimatedView>
      <AnimatedLine text="Why Synapse exists" delay={300} style={styles.founderTitle} color={MAROON} />
      <AnimatedLine text="This app was not built in a boardroom." delay={600} style={styles.founderSub} />
      <AnimatedLine text="It was built from a hospital bed," delay={900} style={styles.founderSub} />
      <AnimatedLine text="from years of managing a condition" delay={1200} style={styles.founderSub} />
      <AnimatedLine text="that never takes a day off." delay={1500} style={styles.founderSub} />
    </View>
  );

  const storySlides = [
    {
      lines: [
        { text: "The app you are about to use", delay: 0, color: C.text },
        { text: "was built for survival.", delay: 400, color: MAROON },
      ],
    },
    {
      lines: [
        { text: "I was born with conditions", delay: 0, color: C.text },
        { text: "that require lifelong medication.", delay: 400, color: C.text },
        { text: "", delay: 600, color: C.text },
        { text: "Missing a dose is not small.", delay: 800, color: C.textSecondary },
        { text: "It is dangerous.", delay: 1100, color: C.red },
      ],
    },
    {
      lines: [
        { text: "Every day is timing.", delay: 0, color: C.text },
        { text: "Every illness is a risk.", delay: 400, color: C.text },
        { text: "Every symptom is a decision.", delay: 800, color: C.text },
        { text: "", delay: 1000, color: C.text },
        { text: "This is not fitness.", delay: 1200, color: C.textSecondary },
        { text: "This is stability.", delay: 1500, color: MAROON },
      ],
    },
    {
      lines: [
        { text: "Most health apps track steps.", delay: 0, color: C.textSecondary },
        { text: "", delay: 200, color: C.text },
        { text: "I needed something", delay: 500, color: C.text },
        { text: "that tracks life-saving routines.", delay: 800, color: C.text },
        { text: "", delay: 1000, color: C.text },
        { text: "So I built it.", delay: 1300, color: MAROON },
      ],
    },
    {
      lines: [
        { text: "This app understands:", delay: 0, color: C.textSecondary },
      ],
      items: [
        { emoji: "💊", text: "Medications that cannot be late", delay: 400 },
        { emoji: "🌡", text: "Sick days that change everything", delay: 700 },
        { emoji: "🧠", text: "Brain fog and fatigue", delay: 1000 },
        { emoji: "🩺", text: "The need for structure", delay: 1300 },
      ],
      footer: { text: "Because I live it.", delay: 1700, color: MAROON },
    },
    {
      lines: [
        { text: "Synapse is not just an app.", delay: 0, color: C.text },
        { text: "", delay: 200, color: C.text },
        { text: "It is the system", delay: 500, color: C.text },
        { text: "I depend on every day.", delay: 800, color: C.text },
      ],
      divider: true,
      footer: { text: "Built by a patient.\nFor patients who cannot afford mistakes.", delay: 1400, color: MAROON },
    },
  ];

  const renderStorySlide = (slideIdx: number) => {
    const slide = storySlides[slideIdx];
    return (
      <View style={styles.storyCenter} key={animKey}>
        {slide.lines.map((line, i) =>
          line.text === "" ? (
            <View key={i} style={{ height: 12 }} />
          ) : (
            <AnimatedLine key={i} text={line.text} delay={line.delay} style={styles.storyLine} color={line.color} />
          )
        )}
        {slide.items && (
          <View style={styles.storyList}>
            {slide.items.map((item, i) => (
              <AnimatedView key={i} delay={item.delay} style={styles.storyListRow}>
                <Text style={styles.storyEmoji}>{item.emoji}</Text>
                <Text style={styles.storyListText}>{item.text}</Text>
              </AnimatedView>
            ))}
          </View>
        )}
        {slide.divider && <AnimatedView delay={1100}><View style={styles.storyDivider} /></AnimatedView>}
        {slide.footer && (
          <AnimatedLine text={slide.footer.text} delay={slide.footer.delay} style={styles.storyFooter} color={slide.footer.color} />
        )}
      </View>
    );
  };

  const renderNameInput = () => (
    <View style={styles.inputCenter} key={animKey}>
      <AnimatedLine
        text={userName.trim() ? `Nice to meet you, ${userName.trim()}` : "What should I call you?"}
        delay={0}
        style={styles.nameTitle}
        color={userName.trim() ? MAROON : C.text}
      />
      <AnimatedView delay={400}>
        <TextInput
          style={styles.nameInput}
          placeholder="Your name"
          placeholderTextColor={C.textTertiary}
          value={userName}
          onChangeText={setUserName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => { if (canContinue()) goNext(); }}
        />
      </AnimatedView>
      <AnimatedLine text="Stored only on your device." delay={700} style={styles.nameHint} color={C.textTertiary} />
    </View>
  );

  const renderMedications = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.setupScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" key={animKey}>
      <AnimatedLine text="Your medications" delay={0} style={styles.setupTitle} color={C.text} />
      <AnimatedLine text="Add what you take daily." delay={300} style={styles.setupSub} color={C.textSecondary} />

      {showMedFields && (
        <AnimatedView delay={0} style={styles.fieldBlock}>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.fieldInput, { flex: 2 }]}
              placeholder="Medication name"
              placeholderTextColor={C.textTertiary}
              value={medName}
              onChangeText={setMedName}
            />
            <TextInput
              style={[styles.fieldInput, { flex: 1 }]}
              placeholder="Dosage"
              placeholderTextColor={C.textTertiary}
              value={medDosage}
              onChangeText={setMedDosage}
              onSubmitEditing={addMed}
              returnKeyType="done"
            />
            <Pressable style={[styles.addBtn, !medName.trim() && { opacity: 0.3 }]} onPress={addMed} disabled={!medName.trim()}>
              <Ionicons name="add" size={20} color="#fff" />
            </Pressable>
          </View>
          {meds.map((m, i) => (
            <AnimatedView key={`${m.name}-${i}`} delay={0} style={styles.medChipRow}>
              <View style={styles.medChip}>
                <Text style={styles.medChipEmoji}>💊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medChipName}>{m.name}</Text>
                  <Text style={styles.medChipDose}>{m.dosage}</Text>
                </View>
                <Pressable onPress={() => removeMed(i)} hitSlop={10}>
                  <Ionicons name="close-circle" size={20} color={C.textTertiary} />
                </Pressable>
              </View>
            </AnimatedView>
          ))}
          {meds.length === 0 && (
            <Text style={styles.fieldHint}>You can add more later in Settings.</Text>
          )}
        </AnimatedView>
      )}
    </ScrollView>
  );

  const renderConditions = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.setupScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" key={animKey}>
      <AnimatedLine text="Your conditions" delay={0} style={styles.setupTitle} color={C.text} />
      <AnimatedLine text="What do you manage?" delay={300} style={styles.setupSub} color={C.textSecondary} />

      {showCondFields && (
        <AnimatedView delay={0} style={styles.fieldBlock}>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.fieldInput, { flex: 1 }]}
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
          <View style={styles.condChipsWrap}>
            {conditions.map(c => (
              <Pressable key={c} style={styles.condChip} onPress={() => removeCondition(c)}>
                <Text style={styles.condChipText}>{c}</Text>
                <Ionicons name="close" size={14} color={C.textSecondary} />
              </Pressable>
            ))}
          </View>
          {conditions.length === 0 && (
            <Text style={styles.fieldHint}>You can always update these later.</Text>
          )}
        </AnimatedView>
      )}
    </ScrollView>
  );

  const renderCompletion = () => (
    <View style={styles.completionCenter} key={animKey}>
      <Animated.View style={[styles.completionCircle, { transform: [{ scale: completionScale }], opacity: completionOpacity }]}>
        <Animated.View style={{ opacity: checkOpacity }}>
          <Ionicons name="checkmark" size={48} color="#fff" />
        </Animated.View>
      </Animated.View>
      <AnimatedLine text="Synapse is ready." delay={800} style={styles.completionTitle} color={MAROON} />
      <AnimatedLine text="Ready to take care of you." delay={1200} style={styles.completionSub} color={C.textSecondary} />
    </View>
  );

  const renderContent = () => {
    if (step === 0) return renderWelcome();
    if (step === 1) return renderFounderIntro();
    if (step >= 2 && step <= 7) return renderStorySlide(step - 2);
    if (step === 8) return renderNameInput();
    if (step === 9) return renderMedications();
    if (step === 10) return renderConditions();
    if (step === 11) return renderCompletion();
    return null;
  };

  const buttonDelay = step === 0 ? 1200 : step === 1 ? 1800 : step >= 2 && step <= 7 ? 1800 : step === 11 ? 1600 : 1000;

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <Animated.View style={[styles.body, { opacity: screenOpacity }]}>
        {renderContent()}
      </Animated.View>

      <View style={styles.footer}>
        {renderDots()}
        <AnimatedView delay={buttonDelay} key={`btn-${animKey}`}>
          <Pressable
            style={[
              styles.continueBtn,
              !canContinue() && { opacity: 0.35 },
            ]}
            onPress={handleContinue}
            disabled={!canContinue()}
          >
            <Text style={styles.continueBtnText}>{getButtonLabel()}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </AnimatedView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 28 },
  body: { flex: 1, justifyContent: "center" },
  footer: { gap: 16, paddingBottom: 8 },

  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  dotContainer: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  dotGlow: {
    position: "absolute", width: 14, height: 14, borderRadius: 7,
    backgroundColor: MAROON_LIGHT,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "rgba(128,0,32,0.2)" },
  dotActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: MAROON },
  dotDone: { backgroundColor: "rgba(128,0,32,0.4)" },

  welcomeCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
  brainLogo: { width: 180, height: 180, resizeMode: "contain" },
  welcomeTitle: {
    fontWeight: "700", fontSize: 36, textAlign: "center",
    letterSpacing: -0.5, marginBottom: 12, marginTop: 24,
  },
  welcomeSub: {
    fontWeight: "400", fontSize: 18, textAlign: "center",
    lineHeight: 28, paddingHorizontal: 10,
  },

  photoCircle: {
    width: 120, height: 120, borderRadius: 60, overflow: "hidden",
    borderWidth: 3, borderColor: MAROON,
    alignSelf: "center", marginBottom: 28,
  },
  photoImage: { width: "100%", height: "100%", resizeMode: "cover" },
  founderTitle: {
    fontWeight: "700", fontSize: 28, textAlign: "center",
    letterSpacing: -0.5, marginBottom: 20,
  },
  founderSub: {
    fontWeight: "400", fontSize: 18, textAlign: "center",
    lineHeight: 28, color: C.textSecondary,
  },

  storyCenter: { flex: 1, justifyContent: "center", paddingHorizontal: 4 },
  storyLine: {
    fontWeight: "600", fontSize: 26, lineHeight: 38,
    letterSpacing: -0.3,
  },
  storyList: { marginTop: 24, gap: 18 },
  storyListRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  storyEmoji: { fontSize: 22 },
  storyListText: { fontWeight: "500", fontSize: 18, color: C.text, flex: 1 },
  storyDivider: {
    width: 40, height: 2, backgroundColor: "rgba(128,0,32,0.2)",
    marginVertical: 24,
  },
  storyFooter: {
    fontWeight: "500", fontSize: 18, lineHeight: 28,
    marginTop: 8,
  },

  inputCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
  nameTitle: {
    fontWeight: "700", fontSize: 28, textAlign: "center",
    letterSpacing: -0.5, marginBottom: 28,
  },
  nameInput: {
    fontWeight: "500", fontSize: 22, color: C.text, textAlign: "center",
    borderBottomWidth: 2, borderBottomColor: MAROON, paddingVertical: 14,
    width: 260,
  },
  nameHint: {
    fontWeight: "400", fontSize: 14, textAlign: "center", marginTop: 14,
  },

  setupScroll: { paddingTop: 20, paddingBottom: 40 },
  setupTitle: {
    fontWeight: "700", fontSize: 28, letterSpacing: -0.5,
    textAlign: "center", marginBottom: 8,
  },
  setupSub: {
    fontWeight: "400", fontSize: 16, textAlign: "center",
    marginBottom: 28, lineHeight: 24,
  },
  fieldBlock: { gap: 2 },
  inputRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  fieldInput: {
    fontWeight: "400", fontSize: 16, color: C.text,
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  addBtn: {
    width: 48, borderRadius: 14, backgroundColor: MAROON,
    alignItems: "center", justifyContent: "center",
  },
  fieldHint: {
    fontWeight: "400", fontSize: 14, color: C.textTertiary,
    textAlign: "center", marginTop: 16,
  },

  medChipRow: { marginBottom: 8 },
  medChip: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: C.border,
  },
  medChipEmoji: { fontSize: 20 },
  medChipName: { fontWeight: "600", fontSize: 16, color: C.text },
  medChipDose: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginTop: 2 },

  condChipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  condChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: C.border,
  },
  condChipText: { fontWeight: "500", fontSize: 15, color: C.text },

  completionCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
  completionCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: MAROON, alignItems: "center", justifyContent: "center",
    marginBottom: 32,
  },
  completionTitle: {
    fontWeight: "700", fontSize: 32, textAlign: "center",
    letterSpacing: -0.5, marginBottom: 8,
  },
  completionSub: {
    fontWeight: "400", fontSize: 18, textAlign: "center",
    lineHeight: 28,
  },

  continueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: MAROON, borderRadius: 16, paddingVertical: 18,
  },
  continueBtnText: { fontWeight: "600", fontSize: 17, color: "#fff" },
});

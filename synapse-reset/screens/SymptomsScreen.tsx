import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Modal, Platform, Alert, useWindowDimensions, useColorScheme,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useModeAwareScreen } from "@/contexts/AppModeContext";
import { symptomStorage, settingsStorage, sickModeStorage, enableRecoveryTracking, type Symptom } from "@/lib/storage";
import { formatTimestamp, getToday, getRelativeDay, getDaysAgo } from "@/lib/date-utils";

const COMMON_SYMPTOMS = [
  "Chest pain",
  "Wheezing",
  "Dizziness",
  "Fatigue",
  "Palpitations",
  "Fever",
  "Other",
] as const;

const QUICK_TRIGGERS = [
  "Resting",
  "Walking",
  "Sitting up",
  "Standing",
  "After medication",
  "After eating",
  "Unknown",
  "Custom",
] as const;

const SIMPLE_SYMPTOM_OPTIONS = [
  "Dizziness",
  "Pain",
  "Fatigue",
  "Fever",
  "Heart",
  "Nausea",
  "Breathing",
  "Other",
] as const;

const SIMPLE_TRIGGER_OPTIONS = [
  "Resting",
  "Activity",
  "After medication",
] as const;

interface SymptomsScreenProps {
  onActivateSickMode?: () => void;
}

export default function SymptomsScreen({ onActivateSickMode }: SymptomsScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const modeUI = useModeAwareScreen("symptoms");
  const colorScheme = useColorScheme();
  const { colors: themeColors, themeId } = useTheme();
  const isDarkUi = themeId === "dark" || (themeId !== "light" && colorScheme === "dark");
  const C = useMemo<Theme>(() => (
    isDarkUi
      ? {
        ...themeColors,
        background: "#000000",
        surface: "#0E0E10",
        surfaceElevated: "#17171A",
        border: "rgba(255,255,255,0.12)",
        text: "#FFFFFF",
        textSecondary: "rgba(255,255,255,0.74)",
        textTertiary: "rgba(255,255,255,0.52)",
      }
      : themeColors
  ), [themeColors, isDarkUi]);
  const styles = useMemo(() => makeStyles(C), [C]);
  const isWide = width >= 768;
  const today = getToday();

  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSymptom, setSelectedSymptom] = useState("");
  const [customSymptom, setCustomSymptom] = useState("");
  const [severity, setSeverity] = useState(5);
  const [selectedTrigger, setSelectedTrigger] = useState<string>("Unknown");
  const [customTrigger, setCustomTrigger] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [feverTemp, setFeverTemp] = useState("");
  const [showFeverAlert, setShowFeverAlert] = useState(false);
  const [showSimpleModal, setShowSimpleModal] = useState(false);
  const [simpleStep, setSimpleStep] = useState<1 | 2 | 3>(1);
  const [simpleSeverity, setSimpleSeverity] = useState<3 | 7 | 9>(3);
  const [simpleTrigger, setSimpleTrigger] = useState("");
  const [simpleNotes, setSimpleNotes] = useState("");
  const [simpleDetailSymptom, setSimpleDetailSymptom] = useState<Symptom | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  const isFeverSelected = selectedSymptom === "Fever";

  const loadData = useCallback(async () => {
    const all = await symptomStorage.getAll();
    setSymptoms(all.sort((a, b) => (b.recordedAt ?? `${b.date}T00:00:00`).localeCompare(a.recordedAt ?? `${a.date}T00:00:00`)));
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async () => {
    const name = selectedSymptom || customSymptom.trim();
    if (!name) return;
    const temp = isFeverSelected && feverTemp.trim() ? parseFloat(feverTemp) : undefined;
    await symptomStorage.save({
      date: today,
      recordedAt: new Date().toISOString(),
      name,
      severity,
      notes: notes.trim(),
      temperature: temp,
      trigger: selectedTrigger,
      customTrigger: selectedTrigger === "Custom" ? customTrigger.trim() || undefined : undefined,
      durationMinutes: durationMinutes.trim() ? Math.max(1, parseInt(durationMinutes, 10) || 1) : undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isFeverSelected && temp && temp >= 100) {
      const settings = await settingsStorage.get();
      if (!settings.sickMode) {
        setShowFeverAlert(true);
      }
    }

    setSelectedSymptom(""); setCustomSymptom(""); setSeverity(5); setSelectedTrigger("Unknown"); setCustomTrigger(""); setDurationMinutes(""); setNotes(""); setFeverTemp("");
    setShowModal(false);
    loadData();
  };

  const handleActivateSickMode = async () => {
    const settings = await settingsStorage.get();
    await settingsStorage.save({ ...settings, sickMode: true });
    await enableRecoveryTracking();
    const sd = await sickModeStorage.get();
    await sickModeStorage.save({ ...sd, active: true, startedAt: new Date().toISOString() });
    setShowFeverAlert(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onActivateSickMode?.();
  };

  const handleDelete = async (s: Symptom) => {
    if (Platform.OS === "web") { await symptomStorage.delete(s.id); loadData(); return; }
    Alert.alert("Remove", `Remove ${s.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { await symptomStorage.delete(s.id); loadData(); } },
    ]);
  };

  const sevColor = (sev: number) => sev >= 8 ? C.red : sev >= 5 ? C.orange : sev >= 2 ? C.yellow : C.green;
  const sevLabel = (sev: number) => sev >= 8 ? "Severe" : sev >= 5 ? "Moderate" : sev >= 2 ? "Mild" : "Minimal";
  const simpleSevLabel = (sev: number) => sev >= 9 ? "Severe" : sev >= 7 ? "Moderate" : "Mild";

  const todaySymptoms = symptoms.filter((s) => s.date === today);
  const recentSymptoms = symptoms.filter((s) => s.date !== today && s.date >= getDaysAgo(7));

  const frequencyMap: Record<string, number> = {};
  symptoms.filter(s => s.date >= getDaysAgo(30)).forEach(s => { frequencyMap[s.name] = (frequencyMap[s.name] || 0) + 1; });
  const topFrequent = Object.entries(frequencyMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((current) => (current === message ? "" : current));
    }, 1800);
  }, []);

  const resetSimpleFlow = useCallback(() => {
    setShowSimpleModal(false);
    setSimpleStep(1);
    setSelectedSymptom("");
    setCustomSymptom("");
    setSimpleSeverity(3);
    setSimpleTrigger("");
    setSimpleNotes("");
    setFeverTemp("");
  }, []);

  const openSimpleLogFlow = useCallback(() => {
    resetSimpleFlow();
    setShowSimpleModal(true);
  }, [resetSimpleFlow]);

  const handleSimpleSeveritySelect = useCallback((value: 3 | 7 | 9) => {
    setSimpleSeverity(value);
    void Haptics.selectionAsync().catch(() => {});
    setSimpleStep(3);
  }, []);

  const handleSimpleSave = useCallback(async () => {
    const name = selectedSymptom === "Other" ? customSymptom.trim() : selectedSymptom.trim();
    if (!name) return;
    const temp = selectedSymptom === "Fever" && feverTemp.trim() ? parseFloat(feverTemp) : undefined;
    await symptomStorage.save({
      date: today,
      recordedAt: new Date().toISOString(),
      name,
      severity: simpleSeverity,
      notes: simpleNotes.trim(),
      temperature: temp,
      trigger: simpleTrigger || undefined,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    if (selectedSymptom === "Fever" && temp && temp >= 100) {
      const settings = await settingsStorage.get();
      if (!settings.sickMode) {
        setShowFeverAlert(true);
      }
    }

    await loadData();
    resetSimpleFlow();
    showToast("Saved");
  }, [customSymptom, feverTemp, loadData, resetSimpleFlow, selectedSymptom, showToast, simpleNotes, simpleSeverity, simpleTrigger, today]);

  const handleSimpleDelete = useCallback((symptom: Symptom) => {
    Alert.alert("Delete symptom?", `${symptom.name} will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await symptomStorage.delete(symptom.id);
          setSimpleDetailSymptom(null);
          await loadData();
        },
      },
    ]);
  }, [loadData]);

  if (modeUI.isSimpleMode) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, styles.simpleContent, {
            paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 18),
            paddingBottom: isWide ? 56 : (Platform.OS === "web" ? 148 : insets.bottom + 140),
          }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.simpleHeader}>
            <Text style={styles.simpleTitle}>Symptoms</Text>
            <Text style={styles.simpleSubtitle}>
              {todaySymptoms.length === 1 ? "1 today" : `${todaySymptoms.length} today`}
            </Text>
          </View>

          {todaySymptoms.length === 0 ? (
            <View style={styles.simpleEmptyCard}>
              <View style={styles.simpleEmptyIcon}>
                <Ionicons name="pulse-outline" size={34} color={C.textTertiary} />
              </View>
              <Text style={styles.simpleEmptyTitle}>No symptoms today</Text>
              <Text style={styles.simpleEmptyBody}>Tap below to log how you&apos;re feeling</Text>
              <Pressable style={styles.simplePrimaryButton} onPress={openSimpleLogFlow}>
                <Text style={styles.simplePrimaryButtonText}>Log symptom</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.simpleSection}>
              {todaySymptoms.map((symptom) => (
                <Pressable
                  key={symptom.id}
                  style={({ pressed }) => [styles.simpleSymptomCard, pressed && styles.simpleSymptomCardPressed]}
                  onPress={() => setSimpleDetailSymptom(symptom)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open symptom details for ${symptom.name}`}
                >
                  <Text style={styles.simpleSymptomName}>{symptom.name}</Text>
                  <Text style={styles.simpleSymptomSeverity}>
                    {simpleSevLabel(symptom.severity)} • {symptom.severity}/10
                  </Text>
                  <Text style={styles.simpleSymptomTime}>
                    {symptom.date === today ? "Today" : getRelativeDay(symptom.date)} • {formatTimestamp(symptom.recordedAt)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={[styles.simpleFooterAction, { bottom: Platform.OS === "web" ? 20 : insets.bottom + 16 }]}>
          <Pressable style={styles.simpleFooterButton} onPress={openSimpleLogFlow}>
            <Text style={styles.simpleFooterButtonText}>Log symptom</Text>
          </Pressable>
        </View>

        <Modal visible={showSimpleModal} transparent animationType="fade">
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={resetSimpleFlow} accessibilityLabel="Close symptom flow" />
            <View style={styles.simpleModal}>
              <Text style={styles.simpleModalTitle}>Log symptom</Text>
              <View style={styles.simpleStepDots}>
                {[1, 2, 3].map((step) => (
                  <View key={step} style={[styles.simpleStepDot, simpleStep === step && styles.simpleStepDotActive]} />
                ))}
              </View>

              {simpleStep === 1 ? (
                <View>
                  <Text style={styles.simpleStepTitle}>Pick a symptom</Text>
                  <View style={styles.simpleChoiceGrid}>
                    {SIMPLE_SYMPTOM_OPTIONS.map((option) => (
                      <Pressable
                        key={option}
                        style={[styles.simpleChoiceButton, selectedSymptom === option && styles.simpleChoiceButtonActive]}
                        onPress={() => {
                          setSelectedSymptom(option);
                          if (option !== "Other") {
                            setCustomSymptom("");
                            void Haptics.selectionAsync().catch(() => {});
                            setSimpleStep(2);
                          }
                        }}
                      >
                        <Text style={[styles.simpleChoiceButtonText, selectedSymptom === option && styles.simpleChoiceButtonTextActive]}>{option}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    style={styles.simpleInput}
                    placeholder="Type your symptom"
                    placeholderTextColor={C.textTertiary}
                    value={customSymptom}
                    onChangeText={(text) => {
                      setCustomSymptom(text);
                      if (text.trim()) setSelectedSymptom("Other");
                    }}
                  />
                  {selectedSymptom === "Other" && customSymptom.trim() ? (
                    <Pressable style={styles.simplePrimaryButton} onPress={() => setSimpleStep(2)}>
                      <Text style={styles.simplePrimaryButtonText}>Continue</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : simpleStep === 2 ? (
                <View>
                  <Text style={styles.simpleStepTitle}>How strong is it?</Text>
                  <View style={styles.simpleSeverityStack}>
                    {[
                      { value: 3 as const, label: "Mild 🙂" },
                      { value: 7 as const, label: "Moderate 😐" },
                      { value: 9 as const, label: "Severe 😟" },
                    ].map((option) => (
                      <Pressable
                        key={option.value}
                        style={styles.simpleSeverityButton}
                        onPress={() => handleSimpleSeveritySelect(option.value)}
                      >
                        <Text style={styles.simpleSeverityButtonText}>{option.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.simpleStepTitle}>Add details</Text>
                  <Text style={styles.simpleOptionalLabel}>Trigger (optional)</Text>
                  <View style={styles.simpleTriggerStack}>
                    {SIMPLE_TRIGGER_OPTIONS.map((option) => (
                      <Pressable
                        key={option}
                        style={[styles.simpleTriggerButton, simpleTrigger === option && styles.simpleTriggerButtonActive]}
                        onPress={() => setSimpleTrigger(simpleTrigger === option ? "" : option)}
                      >
                        <Text style={[styles.simpleTriggerButtonText, simpleTrigger === option && styles.simpleTriggerButtonTextActive]}>{option}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {selectedSymptom === "Fever" ? (
                    <TextInput
                      style={styles.simpleInput}
                      placeholder="Temperature (optional)"
                      placeholderTextColor={C.textTertiary}
                      value={feverTemp}
                      onChangeText={setFeverTemp}
                      keyboardType="decimal-pad"
                    />
                  ) : null}
                  <TextInput
                    style={[styles.simpleInput, styles.simpleNotesInput]}
                    placeholder="Notes (optional)"
                    placeholderTextColor={C.textTertiary}
                    value={simpleNotes}
                    onChangeText={setSimpleNotes}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              )}

              <View style={styles.simpleModalActions}>
                <Pressable
                  style={[styles.simpleSecondaryButton, styles.simpleActionFlex]}
                  onPress={() => {
                    if (simpleStep === 1) {
                      resetSimpleFlow();
                    } else {
                      setSimpleStep((prev) => (prev - 1) as 1 | 2 | 3);
                    }
                  }}
                >
                  <Text style={styles.simpleSecondaryButtonText}>{simpleStep === 1 ? "Cancel" : "Back"}</Text>
                </Pressable>
                {simpleStep === 3 ? (
                  <Pressable
                    style={[
                      styles.simplePrimaryButton,
                      styles.simpleActionFlex,
                      !(selectedSymptom || customSymptom.trim()) && { opacity: 0.5 },
                    ]}
                    onPress={handleSimpleSave}
                    disabled={!(selectedSymptom || customSymptom.trim())}
                  >
                    <Text style={styles.simplePrimaryButtonText}>Save symptom</Text>
                  </Pressable>
                ) : (
                  <View style={styles.simpleModalSpacer} />
                )}
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={!!simpleDetailSymptom} transparent animationType="fade">
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSimpleDetailSymptom(null)} accessibilityLabel="Close symptom details" />
            <View style={styles.simpleModal}>
              {simpleDetailSymptom ? (
                <>
                  <Text style={styles.simpleModalTitle}>{simpleDetailSymptom.name}</Text>
                  <View style={styles.simpleDetailCard}>
                    <Text style={styles.simpleSymptomSeverity}>
                      {simpleSevLabel(simpleDetailSymptom.severity)} • {simpleDetailSymptom.severity}/10
                    </Text>
                    <Text style={styles.simpleSymptomTime}>{formatTimestamp(simpleDetailSymptom.recordedAt)}</Text>
                    {simpleDetailSymptom.trigger ? (
                      <Text style={styles.simpleDetailMeta}>
                        Trigger: {simpleDetailSymptom.trigger === "Custom" ? simpleDetailSymptom.customTrigger : simpleDetailSymptom.trigger}
                      </Text>
                    ) : null}
                    {simpleDetailSymptom.notes ? (
                      <Text style={styles.simpleDetailMeta}>{simpleDetailSymptom.notes}</Text>
                    ) : null}
                  </View>
                  <View style={styles.simpleDetailActions}>
                    <Pressable style={[styles.simpleSecondaryButton, styles.simpleActionFlex]} onPress={() => setSimpleDetailSymptom(null)}>
                      <Text style={styles.simpleSecondaryButtonText}>Done</Text>
                    </Pressable>
                    <Pressable style={[styles.simpleDeleteButton, styles.simpleActionFlex]} onPress={() => handleSimpleDelete(simpleDetailSymptom)}>
                      <Text style={styles.simpleDeleteButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </Modal>

        {toastMessage ? (
          <View style={[styles.simpleToastWrap, { bottom: Platform.OS === "web" ? 96 : insets.bottom + 92 }]}>
            <View style={styles.simpleToastCard}>
              <Text style={styles.simpleToastText}>{toastMessage}</Text>
            </View>
          </View>
        ) : null}

        <Modal visible={showFeverAlert} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.feverAlertCard}>
              <View style={styles.feverAlertIcon}>
                <Ionicons name="warning" size={28} color={C.red} />
              </View>
              <Text style={styles.feverAlertTitle}>Stress dose recommended</Text>
              <Text style={styles.feverAlertDesc}>A temperature of 100°F or higher was recorded. Activating Sick Mode will triple your Hydrocortisone dose and start the recovery protocol.</Text>
              <Pressable style={styles.feverAlertBtn} onPress={handleActivateSickMode} accessibilityRole="button" accessibilityLabel="Activate Sick Mode" accessibilityHint="Triples Hydrocortisone dose and starts recovery protocol">
                <Ionicons name="shield" size={18} color="#fff" />
                <Text style={styles.feverAlertBtnText}>Activate Sick Mode</Text>
              </Pressable>
              <Pressable style={styles.feverAlertDismiss} onPress={() => setShowFeverAlert(false)} accessibilityRole="button" accessibilityLabel="Dismiss fever alert">
                <Text style={styles.feverAlertDismissText}>Not now</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, {
          paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
          paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
        }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Symptoms</Text>
            <Text style={styles.subtitle}>{todaySymptoms.length} today</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={() => setShowModal(true)} accessibilityRole="button" accessibilityLabel="Log symptom" hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>

        {todaySymptoms.length === 0 && recentSymptoms.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="pulse-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No symptoms recorded</Text>
            <Text style={styles.emptyDesc}>Tap + to log a symptom</Text>
          </View>
        )}

        {todaySymptoms.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionLabel}>Today</Text>
            {todaySymptoms.map((s) => (
              <View key={s.id} style={styles.symptomCard}>
                <View style={[styles.sevBar, { backgroundColor: sevColor(s.severity) }]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.symptomName}>{s.name}</Text>
                    {s.name === "Fever" && s.temperature && (
                      <View style={[styles.tempBadge, s.temperature >= 100 && styles.tempBadgeHigh]}>
                        <Text style={[styles.tempBadgeText, s.temperature >= 100 && { color: C.red }]}>{s.temperature}°F</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.sevText, { color: sevColor(s.severity) }]}>{sevLabel(s.severity)} · {s.severity}/10</Text>
                  <Text style={styles.symptomMeta}>{formatTimestamp(s.recordedAt)}</Text>
                  {(s.trigger || s.durationMinutes) ? (
                    <Text style={styles.symptomMeta}>
                      {[s.trigger === "Custom" ? s.customTrigger : s.trigger, s.durationMinutes ? `${s.durationMinutes} min` : null].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                  {!!s.notes && <Text style={styles.symptomNotes}>{s.notes}</Text>}
                </View>
                <Pressable onPress={() => handleDelete(s)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove ${s.name}`}>
                  <Ionicons name="close-circle-outline" size={18} color={C.textTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {topFrequent.length > 0 && (
          <View style={[styles.card, { marginBottom: 20 }]}>
            <Text style={styles.cardTitle}>Most Frequent (30d)</Text>
            {topFrequent.map(([name, count]) => (
              <View key={name} style={styles.freqRow}>
                <Text style={styles.freqName}>{name}</Text>
                <View style={styles.freqBarOuter}>
                  <View style={[styles.freqBarInner, { width: `${(count / topFrequent[0][1]) * 100}%` }]} />
                </View>
                <Text style={styles.freqCount}>{count}</Text>
              </View>
            ))}
          </View>
        )}

        {recentSymptoms.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>Recent</Text>
            {recentSymptoms.slice(0, 10).map((s) => (
              <View key={s.id} style={styles.recentCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentName}>{s.name}</Text>
                  <Text style={styles.recentDate}>{getRelativeDay(s.date)}</Text>
                  <Text style={styles.recentTime}>{formatTimestamp(s.recordedAt)}</Text>
                </View>
                <View style={[styles.sevBadge, { backgroundColor: sevColor(s.severity) + "22" }]}>
                  <Text style={[styles.sevBadgeText, { color: sevColor(s.severity) }]}>{s.severity}/10</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Quick Symptom Event</Text>
            <Text style={styles.quickHint}>Fast log: pick symptom, severity, and trigger. Notes are optional.</Text>
            <Text style={styles.label}>Symptom type</Text>
            <View style={styles.chipGrid}>
              {COMMON_SYMPTOMS.map((s) => (
                <Pressable key={s} style={[styles.chip, selectedSymptom === s && { backgroundColor: C.tintLight, borderColor: C.tint }]} onPress={() => { setSelectedSymptom(selectedSymptom === s ? "" : s); setCustomSymptom(""); Haptics.selectionAsync(); }} accessibilityRole="button" accessibilityLabel={s} accessibilityState={{ selected: selectedSymptom === s }}>
                  <Text style={[styles.chipText, selectedSymptom === s && { color: C.tint }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            {(selectedSymptom === "Other" || !selectedSymptom) && (
              <TextInput style={styles.input} placeholder="Type custom symptom" placeholderTextColor={C.textTertiary} value={customSymptom} onChangeText={(t) => { setCustomSymptom(t); if (t.trim()) setSelectedSymptom("Other"); }} accessibilityLabel="Custom symptom name" />
            )}

            {isFeverSelected && (
              <View style={styles.feverInputWrap}>
                <View style={styles.feverInputRow}>
                  <Text style={{ fontSize: 20 }}>🌡️</Text>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Temperature (°F)"
                    placeholderTextColor={C.textTertiary}
                    value={feverTemp}
                    onChangeText={setFeverTemp}
                    keyboardType="decimal-pad"
                  />
                </View>
                {feverTemp && parseFloat(feverTemp) >= 100 && (
                  <View style={styles.feverWarning}>
                    <Ionicons name="warning" size={14} color={C.red} />
                    <Text style={styles.feverWarningText}>High fever — stress dose may be needed</Text>
                  </View>
                )}
              </View>
            )}

            <Text style={styles.label}>Severity</Text>
            <View style={styles.sevPicker}>
              {Array.from({ length: 11 }, (_, i) => i).map((i) => (
                <Pressable key={i} style={[styles.sevPickBtn, severity === i && { backgroundColor: sevColor(i) + "22", borderColor: sevColor(i) }]} onPress={() => { setSeverity(i); Haptics.selectionAsync(); }} accessibilityRole="button" accessibilityLabel={`Severity ${i}, ${sevLabel(i)}`} accessibilityState={{ selected: severity === i }}>
                  <Text style={[styles.sevPickNum, severity === i && { color: sevColor(i) }]}>{i}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Trigger</Text>
            <View style={styles.chipGrid}>
              {QUICK_TRIGGERS.map((trigger) => (
                <Pressable
                  key={trigger}
                  style={[styles.chip, selectedTrigger === trigger && { backgroundColor: C.orangeLight, borderColor: C.orange }]}
                  onPress={() => { setSelectedTrigger(trigger); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.chipText, selectedTrigger === trigger && { color: C.orange }]}>{trigger}</Text>
                </Pressable>
              ))}
            </View>
            {selectedTrigger === "Custom" && (
              <TextInput
                style={styles.input}
                placeholder="Type your trigger"
                placeholderTextColor={C.textTertiary}
                value={customTrigger}
                onChangeText={setCustomTrigger}
                accessibilityLabel="Custom trigger"
              />
            )}
            <Text style={styles.label}>Duration (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Minutes"
              placeholderTextColor={C.textTertiary}
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              keyboardType="number-pad"
              accessibilityLabel="Duration in minutes"
            />
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput style={[styles.input, { minHeight: 60 }]} placeholder="Additional details..." placeholderTextColor={C.textTertiary} value={notes} onChangeText={setNotes} multiline textAlignVertical="top" accessibilityLabel="Symptom notes" />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowModal(false)} accessibilityRole="button" accessibilityLabel="Cancel"><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={[styles.confirmBtn, !(selectedSymptom || customSymptom.trim()) && { opacity: 0.5 }]} onPress={handleAdd} disabled={!(selectedSymptom || customSymptom.trim())} accessibilityRole="button" accessibilityLabel="Log symptom"><Text style={styles.confirmText}>Log</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showFeverAlert} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.feverAlertCard}>
            <View style={styles.feverAlertIcon}>
              <Ionicons name="warning" size={28} color={C.red} />
            </View>
            <Text style={styles.feverAlertTitle}>Stress dose recommended</Text>
            <Text style={styles.feverAlertDesc}>A temperature of 100°F or higher was recorded. Activating Sick Mode will triple your Hydrocortisone dose and start the recovery protocol.</Text>
            <Pressable style={styles.feverAlertBtn} onPress={handleActivateSickMode} accessibilityRole="button" accessibilityLabel="Activate Sick Mode" accessibilityHint="Triples Hydrocortisone dose and starts recovery protocol">
              <Ionicons name="shield" size={18} color="#fff" />
              <Text style={styles.feverAlertBtnText}>Activate Sick Mode</Text>
            </Pressable>
            <Pressable style={styles.feverAlertDismiss} onPress={() => setShowFeverAlert(false)} accessibilityRole="button" accessibilityLabel="Dismiss fever alert">
              <Text style={styles.feverAlertDismissText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 24 },
    simpleContent: { gap: 16 },
    simpleHeader: { gap: 4, marginBottom: 4 },
    simpleTitle: { fontWeight: "800", fontSize: 32, color: C.text, letterSpacing: -0.8 },
    simpleSubtitle: { fontWeight: "500", fontSize: 18, color: C.textSecondary },
    simpleSection: { gap: 10 },
    simpleSymptomCard: { backgroundColor: C.surface, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: C.border, gap: 6 },
    simpleSymptomCardPressed: { opacity: 0.96, transform: [{ scale: 0.995 }] },
    simpleSymptomName: { fontWeight: "800", fontSize: 22, color: C.text, letterSpacing: -0.4 },
    simpleSymptomSeverity: { fontWeight: "600", fontSize: 17, color: C.textSecondary },
    simpleSymptomTime: { fontWeight: "500", fontSize: 15, color: C.textTertiary },
    simpleEmptyCard: { alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: 24, paddingHorizontal: 22, paddingVertical: 28, borderWidth: 1, borderColor: C.border },
    simpleEmptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: C.surfaceElevated, alignItems: "center", justifyContent: "center" },
    simpleEmptyTitle: { fontWeight: "800", fontSize: 22, color: C.text, textAlign: "center" },
    simpleEmptyBody: { fontWeight: "500", fontSize: 16, color: C.textSecondary, textAlign: "center", lineHeight: 22 },
    simplePrimaryButton: { minHeight: 56, borderRadius: 18, backgroundColor: C.orange, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
    simplePrimaryButtonText: { fontWeight: "800", fontSize: 18, color: "#fff" },
    simpleSecondaryButton: { minHeight: 56, borderRadius: 18, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
    simpleSecondaryButtonText: { fontWeight: "700", fontSize: 17, color: C.text },
    simpleDeleteButton: { minHeight: 56, borderRadius: 18, backgroundColor: C.redLight, borderWidth: 1, borderColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
    simpleDeleteButtonText: { fontWeight: "800", fontSize: 17, color: C.red },
    simpleActionFlex: { flex: 1 },
    simpleFooterAction: { position: "absolute", left: 16, right: 16 },
    simpleFooterButton: { minHeight: 60, borderRadius: 20, backgroundColor: C.orange, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 5 },
    simpleFooterButtonText: { fontWeight: "800", fontSize: 20, color: "#fff" },
    simpleModal: { backgroundColor: C.surface, borderRadius: 24, padding: 24, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: C.border, maxHeight: "88%" },
    simpleModalTitle: { fontWeight: "800", fontSize: 24, color: C.text, marginBottom: 14, letterSpacing: -0.4 },
    simpleStepDots: { flexDirection: "row", gap: 8, marginBottom: 18 },
    simpleStepDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: C.border },
    simpleStepDotActive: { width: 24, backgroundColor: C.orange },
    simpleStepTitle: { fontWeight: "800", fontSize: 22, color: C.text, marginBottom: 14, letterSpacing: -0.4 },
    simpleChoiceGrid: { gap: 10, marginBottom: 14 },
    simpleChoiceButton: { minHeight: 56, borderRadius: 18, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border, justifyContent: "center", paddingHorizontal: 18 },
    simpleChoiceButtonActive: { backgroundColor: C.orangeLight, borderColor: C.orange },
    simpleChoiceButtonText: { fontWeight: "700", fontSize: 18, color: C.text },
    simpleChoiceButtonTextActive: { color: C.orange },
    simpleInput: { fontWeight: "500", fontSize: 17, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
    simpleSeverityStack: { gap: 10 },
    simpleSeverityButton: { minHeight: 58, borderRadius: 18, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
    simpleSeverityButtonText: { fontWeight: "700", fontSize: 18, color: C.text },
    simpleOptionalLabel: { fontWeight: "600", fontSize: 14, color: C.textSecondary, marginBottom: 8 },
    simpleTriggerStack: { gap: 10, marginBottom: 14 },
    simpleTriggerButton: { minHeight: 52, borderRadius: 16, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border, justifyContent: "center", paddingHorizontal: 16 },
    simpleTriggerButtonActive: { backgroundColor: C.orangeLight, borderColor: C.orange },
    simpleTriggerButtonText: { fontWeight: "700", fontSize: 16, color: C.textSecondary },
    simpleTriggerButtonTextActive: { color: C.orange },
    simpleNotesInput: { minHeight: 92 },
    simpleModalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
    simpleModalSpacer: { flex: 1 },
    simpleDetailCard: { backgroundColor: C.surfaceElevated, borderRadius: 18, padding: 18, gap: 8, marginBottom: 16, borderWidth: 1, borderColor: C.border },
    simpleDetailMeta: { fontWeight: "500", fontSize: 15, color: C.textSecondary, lineHeight: 21 },
    simpleDetailActions: { flexDirection: "row", gap: 10 },
    simpleToastWrap: { position: "absolute", left: 16, right: 16 },
    simpleToastCard: { backgroundColor: C.text, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, alignItems: "center" },
    simpleToastText: { fontWeight: "700", fontSize: 15, color: "#fff" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
    title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
    subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary },
    addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.orange, alignItems: "center", justifyContent: "center" },
    empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
    emptyTitle: { fontWeight: "600", fontSize: 17, color: C.text, marginTop: 8 },
    emptyDesc: { fontWeight: "400", fontSize: 13, color: C.textTertiary },
    sectionLabel: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
    symptomCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: C.border, gap: 12 },
    sevBar: { width: 3, height: 36, borderRadius: 2, marginTop: 2 },
    symptomName: { fontWeight: "600", fontSize: 14, color: C.text },
    sevText: { fontWeight: "500", fontSize: 12, marginTop: 2 },
    symptomMeta: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: 3 },
    symptomNotes: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 4 },
    card: { backgroundColor: C.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: C.border },
    cardTitle: { fontWeight: "600", fontSize: 14, color: C.text, marginBottom: 14 },
    freqRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
    freqName: { fontWeight: "500", fontSize: 13, color: C.text, width: 100 },
    freqBarOuter: { flex: 1, height: 6, backgroundColor: C.surfaceElevated, borderRadius: 3, overflow: "hidden" },
    freqBarInner: { height: "100%", backgroundColor: C.orange, borderRadius: 3 },
    freqCount: { fontWeight: "600", fontSize: 12, color: C.textSecondary, width: 20, textAlign: "right" },
    recentCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: C.border },
    recentName: { fontWeight: "500", fontSize: 13, color: C.text },
    recentDate: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: 2 },
    recentTime: { fontWeight: "500", fontSize: 11, color: C.textTertiary, marginTop: 2 },
    sevBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    sevBadgeText: { fontWeight: "600", fontSize: 11 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
    modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: C.border, maxHeight: "90%" },
    modalTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 16 },
    quickHint: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginBottom: 14, lineHeight: 18 },
    label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
    chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated },
    chipText: { fontWeight: "500", fontSize: 12, color: C.textSecondary },
    input: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
    sevPicker: { flexDirection: "row", gap: 6, marginBottom: 14 },
    sevPickBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated },
    sevPickNum: { fontWeight: "700", fontSize: 16, color: C.textSecondary },
    modalActions: { flexDirection: "row", gap: 10 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
    cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
    confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.orange, alignItems: "center" },
    confirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
    feverInputWrap: { marginBottom: 14, gap: 8 },
    feverInputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    feverWarning: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.redLight, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "rgba(255,69,58,0.25)" },
    feverWarningText: { fontWeight: "500", fontSize: 12, color: C.red },
    tempBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: C.orangeLight },
    tempBadgeHigh: { backgroundColor: C.redLight },
    tempBadgeText: { fontWeight: "600", fontSize: 11, color: C.orange },
    feverAlertCard: { backgroundColor: C.surface, borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: "rgba(255,69,58,0.3)", alignItems: "center" },
    feverAlertIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.redLight, alignItems: "center", justifyContent: "center", marginBottom: 16 },
    feverAlertTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 8 },
    feverAlertDesc: { fontWeight: "400", fontSize: 13, color: C.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 20 },
    feverAlertBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.red, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: "100%" },
    feverAlertBtnText: { fontWeight: "600", fontSize: 14, color: "#fff" },
    feverAlertDismiss: { paddingVertical: 12 },
    feverAlertDismissText: { fontWeight: "500", fontSize: 13, color: C.textTertiary },
  });
}

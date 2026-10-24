import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, useWindowDimensions, Animated, Alert, Modal,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  medicationStorage, medicationLogStorage, settingsStorage, sickModeStorage, comfortStorage,
  disableRecoveryTracking,
  type Medication, type MedicationLog, type SickModeData, type ComfortItem,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";
import { useAccessibility } from "@/lib/accessibility";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { getSickModePalette } from "@/constants/sick-mode-colors";
import { syncWidgetSnapshot } from "@/lib/widget-sync";
import { cancelRecoveryCheckIn, syncMissedMedicationCheckIn } from "@/lib/notification-manager";
import { modalOverlay, modalSurface } from "@/lib/modal-colors";
import { raised } from "@/constants/raised";
import {
  applyCheckIn,
  applyTemperatureLog,
  CHECK_IN_INTERVAL_MS,
  type FeelingChoice,
} from "@/lib/sick-mode-checkin";

const COMFORT_WINDOW_MS = 24 * 60 * 60 * 1000;

type ToolId = "temperature" | "hydration" | "food" | "rest" | "help" | "history" | null;

interface SickModeScreenProps {
  onDeactivate: () => void;
  onRefreshKey?: number;
  onNavigate?: (screen: string) => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatClock(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function SickModeScreen({ onDeactivate, onRefreshKey, onNavigate }: SickModeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const today = getToday();
  const { reduceMotion } = useAccessibility();
  const { colors: C, themeId } = useTheme();
  const S = getSickModePalette(themeId);

  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [sickData, setSickData] = useState<SickModeData | null>(null);
  const [showActivated, setShowActivated] = useState(false);
  const activatedOpacity = useRef(new Animated.Value(1)).current;

  const [checkInCountdown, setCheckInCountdown] = useState(0);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInFeeling, setCheckInFeeling] = useState<FeelingChoice | null>(null);
  const [checkInTemp, setCheckInTemp] = useState("");
  const [checkInNote, setCheckInNote] = useState("");
  const [comfortItems, setComfortItems] = useState<ComfortItem[]>([]);
  const [expandedCare, setExpandedCare] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolId>(null);
  const [tempInput, setTempInput] = useState("");
  const [hydrationInput, setHydrationInput] = useState("250");
  const [showMoreTools, setShowMoreTools] = useState(false);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    const [meds, logs, sd, comfort] = await Promise.all([
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
      sickModeStorage.get(),
      comfortStorage.getAll(),
    ]);
    setComfortItems(comfort);
    setMedications(meds.filter((m) => m.active));
    setMedLogs(logs);

    if (sd.startedAt && !sd.checkInTimer && !sd.recoveryMode) {
      const checkInTime = new Date(new Date(sd.startedAt).getTime() + CHECK_IN_INTERVAL_MS).toISOString();
      const updated = { ...sd, checkInTimer: checkInTime };
      await sickModeStorage.save(updated);
      setSickData(updated);
      await syncWidgetSnapshot().catch(() => {});
    } else {
      setSickData(sd);
    }

    if (sd.startedAt) {
      const startTime = new Date(sd.startedAt).getTime();
      if (Date.now() - startTime < 5000) {
        setShowActivated(true);
        setTimeout(() => {
          if (reduceMotion) {
            setShowActivated(false);
          } else {
            Animated.timing(activatedOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }).start(() => {
              setShowActivated(false);
              activatedOpacity.setValue(1);
            });
          }
        }, 3000);
      }
    }
  }, [today, reduceMotion, activatedOpacity]);

  useEffect(() => { loadData(); }, [loadData, onRefreshKey]);

  useEffect(() => {
    if (countdownInterval.current) clearInterval(countdownInterval.current);

    if (sickData?.checkInTimer && !sickData.recoveryMode) {
      const tick = () => {
        const target = new Date(sickData.checkInTimer!).getTime();
        const remaining = target - Date.now();
        if (remaining <= 0) {
          setCheckInCountdown(0);
          setShowCheckInModal(true);
          if (countdownInterval.current) clearInterval(countdownInterval.current);
        } else {
          setCheckInCountdown(remaining);
        }
      };
      tick();
      countdownInterval.current = setInterval(tick, 1000);
    }

    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [sickData?.checkInTimer, sickData?.recoveryMode]);

  const stressMeds = medications.filter((m) => m.hasStressDose);

  const getStressDosesTakenToday = (medId: string) =>
    medLogs.filter((l) => l.medicationId === medId && l.taken).length;

  const handleStressDoseLog = (med: Medication) => {
    const amount = med.stressDoseAmount?.trim() || "saved sick-day dose";
    Alert.alert(
      "Record dose taken?",
      `This logs that you took your saved sick-day dose of ${med.name} (${amount}). It does not change your usual regimen or prescribe a new dose.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Record dose taken",
          onPress: async () => {
            const takenCount = getStressDosesTakenToday(med.id);
            await medicationLogStorage.toggle(med.id, today, takenCount);
            await syncMissedMedicationCheckIn().catch(() => {});
            await syncWidgetSnapshot().catch(() => {});
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadData();
          },
        },
      ]
    );
  };

  const persistSick = async (updated: SickModeData) => {
    await sickModeStorage.save(updated);
    setSickData(updated);
    await syncWidgetSnapshot().catch(() => {});
  };

  const handleCheckInSubmit = async () => {
    if (!sickData || !checkInFeeling) return;

    const tempVal = parseFloat(checkInTemp);
    const hasTemp = checkInTemp.trim().length > 0 && !Number.isNaN(tempVal);
    const { next, highFever, enteredRecovering } = applyCheckIn(sickData, {
      feeling: checkInFeeling,
      temperatureF: hasTemp ? tempVal : null,
      note: checkInNote,
    });

    await persistSick(next);
    setShowCheckInModal(false);
    setCheckInFeeling(null);
    setCheckInTemp("");
    setCheckInNote("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (highFever) {
      Alert.alert(
        "High fever — seek care",
        `Your temperature is ${tempVal}°F. Contact a doctor or seek urgent care. This check-in was saved; Sick Mode stays on until you end it.`,
        [{ text: "OK" }]
      );
    } else if (enteredRecovering) {
      Alert.alert(
        "Glad you’re improving",
        "Sick Mode is now in recovering. Check-ins pause. End Sick Mode when you feel ready — your logs stay saved.",
        [{ text: "OK" }]
      );
    } else if (checkInFeeling === "worse") {
      Alert.alert(
        "Check-in saved",
        "We’ll remind you again in about 2 hours. If symptoms are severe or you have adrenal crisis instructions, seek emergency care now.",
        [{ text: "OK" }]
      );
    } else {
      Alert.alert("Check-in saved", "We’ll remind you again in about 2 hours.", [{ text: "OK" }]);
    }
  };

  const skipCheckIn = async () => {
    if (!sickData) {
      setShowCheckInModal(false);
      return;
    }
    // Persist next timer so skip doesn’t strand the protocol.
    const { next } = applyCheckIn(sickData, { feeling: "same" });
    await persistSick(next);
    setShowCheckInModal(false);
    setCheckInFeeling(null);
    setCheckInTemp("");
    setCheckInNote("");
  };

  const addHydration = async (ml: number) => {
    if (!sickData || ml <= 0) return;
    await persistSick({ ...sickData, hydrationMl: sickData.hydrationMl + ml });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTool(null);
  };

  const toggleFood = async () => {
    if (!sickData) return;
    await persistSick({
      ...sickData,
      foodChecklist: { ...sickData.foodChecklist, lightMeal: !sickData.foodChecklist.lightMeal },
    });
    Haptics.selectionAsync();
  };

  const toggleRest = async () => {
    if (!sickData) return;
    await persistSick({
      ...sickData,
      restChecklist: { ...sickData.restChecklist, lying: !sickData.restChecklist.lying },
    });
    Haptics.selectionAsync();
  };

  const addTemperature = async () => {
    const val = parseFloat(tempInput);
    if (Number.isNaN(val) || !sickData) return;
    await persistSick(applyTemperatureLog(sickData, val));
    setTempInput("");
    setActiveTool(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (val >= 102) {
      Alert.alert(
        "High fever — seek care",
        `Your temperature is ${val}°F. Contact a doctor or seek urgent care.`,
        [{ text: "OK" }]
      );
    }
  };

  const markFeelingBetter = () => {
    if (!sickData) return;
    Alert.alert(
      "Mark as recovering?",
      "This pauses check-ins and shows a calmer recovering state. It does not end Sick Mode or erase logs.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "I’m improving",
          onPress: async () => {
            await persistSick({
              ...sickData,
              recoveryMode: true,
              checkInTimer: undefined,
              lastCheckIn: new Date().toISOString(),
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleEndSickMode = () => {
    Alert.alert(
      "End Sick Mode?",
      "Active recovery check-ins will stop. Your temperatures, medication logs, and session history stay saved.",
      [
        { text: "Keep Sick Mode", style: "cancel" },
        {
          text: "End Sick Mode",
          style: "destructive",
          onPress: async () => {
            const settings = await settingsStorage.get();
            await settingsStorage.save({ ...settings, sickMode: false });
            await sickModeStorage.reset();
            await disableRecoveryTracking().catch(() => {});
            await cancelRecoveryCheckIn();
            await syncWidgetSnapshot().catch(() => {});
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDeactivate();
          },
        },
      ]
    );
  };

  const styles = useMemo(() => makeStyles(C, S), [C, S]);

  if (!sickData) return null;

  const isRecovery = sickData.recoveryMode === true;
  const latestTemp = sickData.temperatures?.slice(-1)[0];
  const checkInDue = !isRecovery && !!sickData.checkInTimer && checkInCountdown <= 0;
  const checkInSoon = !isRecovery && checkInCountdown > 0 && checkInCountdown <= CHECK_IN_INTERVAL_MS;
  const nextCheckInLabel = sickData.checkInTimer ? formatClock(sickData.checkInTimer) : null;

  const nextStep = (() => {
    if (checkInDue || showCheckInModal) {
      return {
        title: "How are you feeling?",
        body: "You can check in whenever you need to.",
        actionLabel: "Check in now",
        onAction: () => setShowCheckInModal(true),
        meta: nextCheckInLabel ? `Scheduled around ${nextCheckInLabel}` : undefined,
      };
    }
    if (checkInSoon) {
      return {
        title: "How are you feeling?",
        body: "You can check in whenever you need to.",
        actionLabel: "Check in now",
        onAction: () => setShowCheckInModal(true),
        meta: `Next optional reminder in ${formatCountdown(checkInCountdown)}`,
      };
    }
    if (stressMeds.length > 0 && stressMeds.every((m) => getStressDosesTakenToday(m.id) === 0) && !isRecovery) {
      return {
        title: "Review your sick-day medication plan",
        body: "Your saved clinician-provided instructions are available when you need them.",
        actionLabel: "View medication plan",
        onAction: () => setExpandedCare("meds"),
        meta: undefined,
      };
    }
    if (isRecovery) {
      return {
        title: "Nothing urgent right now",
        body: "Rest and ease back at your pace. End Sick Mode when you feel ready.",
        actionLabel: "I’m still improving",
        onAction: () => Haptics.selectionAsync(),
        meta: "Check-ins are paused while recovering",
        quiet: true,
      };
    }
    return {
      title: "Nothing you need to do right now",
      body: "Rest. We’ll remind you when it’s time to check in.",
      actionLabel: "Check in early",
      onAction: () => setShowCheckInModal(true),
      meta: nextCheckInLabel ? `Next check-in around ${nextCheckInLabel}` : undefined,
      quiet: true,
    };
  })();

  const withinComfort = !!(sickData.startedAt && Date.now() - new Date(sickData.startedAt).getTime() < COMFORT_WINDOW_MS);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, {
          paddingTop: isWide ? 28 : (Platform.OS === "web" ? 40 : 8),
          paddingBottom: isWide ? 60 : (Platform.OS === "web" ? 140 : insets.bottom + 120),
        }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Level 1 — Calm status */}
        <View style={styles.statusHeader}>
          <View style={styles.statusChip}>
            <View style={[styles.statusDot, isRecovery && { backgroundColor: C.green }]} />
            <Text style={styles.statusChipText}>{isRecovery ? "Recovering" : "Sick Mode Active"}</Text>
          </View>
          <Text style={styles.heroTitle}>Taking care of you</Text>
          <Text style={styles.heroSubtitle}>
            You’re in Sick Mode. Focus on resting and following your care plan.
          </Text>
          {latestTemp ? (
            <Text style={styles.heroMeta}>Last temperature {latestTemp.value}°F · {latestTemp.time}</Text>
          ) : null}
        </View>

        {showActivated ? (
          <Animated.View style={[styles.activatedMsg, { opacity: activatedOpacity }]}>
            <Ionicons name="shield-checkmark" size={16} color={C.tint} />
            <Text style={styles.activatedText}>Sick Mode is on. We’ll keep check-ins gentle.</Text>
          </Animated.View>
        ) : null}

        {/* Level 2 — Next step */}
        <View style={styles.nextCard}>
          <Text style={styles.nextEyebrow}>Up next</Text>
          <Text style={styles.nextTitle}>{nextStep.title}</Text>
          <Text style={styles.nextBody}>{nextStep.body}</Text>
          <Pressable
            style={[styles.nextPrimaryBtn, nextStep.quiet && styles.nextPrimaryBtnQuiet]}
            onPress={nextStep.onAction}
            accessibilityRole="button"
            accessibilityLabel={nextStep.actionLabel}
          >
            <Text style={[styles.nextPrimaryText, nextStep.quiet && styles.nextPrimaryTextQuiet]}>
              {nextStep.actionLabel}
            </Text>
            <Ionicons name="arrow-forward" size={16} color={nextStep.quiet ? C.text : "#fff"} />
          </Pressable>
          {nextStep.meta ? (
            <View style={styles.nextMetaRow}>
              <Ionicons name="time-outline" size={14} color={C.textTertiary} />
              <Text style={styles.nextMeta}>{nextStep.meta}</Text>
            </View>
          ) : null}
        </View>

        {/* Stress dosing — safety critical, prominent when configured */}
        {stressMeds.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your saved sick-day medication plan</Text>
            <Text style={styles.sectionHint}>
              These are instructions you saved from your clinician. Synapse does not prescribe or change doses.
            </Text>
            {stressMeds.map((med) => {
              const takenToday = getStressDosesTakenToday(med.id);
              return (
                <View key={med.id} style={styles.stressCard}>
                  <View style={styles.stressHeader}>
                    <Ionicons name="shield-checkmark-outline" size={22} color={C.tint} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stressTitle}>{med.name}</Text>
                      {med.stressDoseAmount ? (
                        <Text style={styles.stressDose}>{med.stressDoseAmount}</Text>
                      ) : null}
                    </View>
                  </View>
                  {med.stressDoseFrequency ? (
                    <Text style={styles.stressDetail}>{med.stressDoseFrequency}</Text>
                  ) : null}
                  {med.stressDoseDurationDays ? (
                    <Text style={styles.stressDetail}>
                      For {med.stressDoseDurationDays} day{med.stressDoseDurationDays > 1 ? "s" : ""}
                    </Text>
                  ) : null}
                  {med.stressDoseInstructions ? (
                    <Text style={styles.stressDetail}>{med.stressDoseInstructions}</Text>
                  ) : null}
                  <Text style={styles.stressLogged}>
                    {takenToday} dose{takenToday === 1 ? "" : "s"} recorded today
                  </Text>
                  <Pressable
                    style={styles.recordDoseBtn}
                    onPress={() => handleStressDoseLog(med)}
                    accessibilityRole="button"
                    accessibilityLabel={`Record dose taken for ${med.name}`}
                  >
                    <Text style={styles.recordDoseBtnText}>Record dose taken</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Medication instructions</Text>
            <View style={styles.careRow}>
              <Ionicons name="medical-outline" size={20} color={C.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.careRowTitle}>No sick-day plan saved</Text>
                <Text style={styles.careRowBody}>
                  Follow your clinician’s instructions. You can add sick-day details on a medication’s edit screen.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Level 3 — Care plan summaries */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your care plan</Text>

          <Pressable
            style={styles.careRow}
            onPress={() => setExpandedCare(expandedCare === "temp" ? null : "temp")}
            accessibilityRole="button"
            accessibilityLabel="Temperature care plan"
          >
            <Ionicons name="thermometer-outline" size={20} color={C.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.careRowTitle}>Temperature</Text>
              <Text style={styles.careRowBody}>
                {latestTemp ? `Last recorded: ${latestTemp.value}°F at ${latestTemp.time}` : "No reading yet"}
              </Text>
            </View>
            <Ionicons name={expandedCare === "temp" ? "chevron-up" : "chevron-down"} size={18} color={C.textTertiary} />
          </Pressable>
          {expandedCare === "temp" ? (
            <View style={styles.expandPanel}>
              <View style={styles.inlineLogRow}>
                <TextInput
                  style={styles.inlineInput}
                  placeholder="°F"
                  placeholderTextColor={C.textTertiary}
                  value={tempInput}
                  onChangeText={setTempInput}
                  keyboardType="decimal-pad"
                />
                <Pressable
                  style={[styles.inlineSave, !tempInput.trim() && { opacity: 0.4 }]}
                  onPress={addTemperature}
                  disabled={!tempInput.trim()}
                >
                  <Text style={styles.inlineSaveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Pressable
            style={styles.careRow}
            onPress={() => setExpandedCare(expandedCare === "hydration" ? null : "hydration")}
            accessibilityRole="button"
            accessibilityLabel="Hydration care plan"
          >
            <Ionicons name="water-outline" size={20} color={C.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.careRowTitle}>Hydration</Text>
              <Text style={styles.careRowBody}>
                {sickData.hydrationMl > 0
                  ? `${sickData.hydrationMl} mL logged today`
                  : "Log fluids when you can — no universal goal required"}
              </Text>
            </View>
            <Ionicons name={expandedCare === "hydration" ? "chevron-up" : "chevron-down"} size={18} color={C.textTertiary} />
          </Pressable>
          {expandedCare === "hydration" ? (
            <View style={styles.expandPanel}>
              <View style={styles.chipRow}>
                {[150, 250, 500].map((ml) => (
                  <Pressable key={ml} style={styles.chip} onPress={() => addHydration(ml)}>
                    <Text style={styles.chipText}>+{ml} mL</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <Pressable style={styles.careRow} onPress={toggleFood} accessibilityRole="button" accessibilityLabel="Food">
            <Ionicons name="restaurant-outline" size={20} color={C.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.careRowTitle}>Food</Text>
              <Text style={styles.careRowBody}>
                {sickData.foodChecklist.lightMeal ? "Meal logged" : "Log a meal if you’ve eaten"}
              </Text>
            </View>
            <Ionicons
              name={sickData.foodChecklist.lightMeal ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={sickData.foodChecklist.lightMeal ? C.green : C.textTertiary}
            />
          </Pressable>

          <Pressable style={styles.careRow} onPress={toggleRest} accessibilityRole="button" accessibilityLabel="Rest">
            <Ionicons name="bed-outline" size={20} color={C.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.careRowTitle}>Rest</Text>
              <Text style={styles.careRowBody}>
                {sickData.restChecklist.lying ? "Rest noted" : "Take it easy while recovering"}
              </Text>
            </View>
            <Ionicons
              name={sickData.restChecklist.lying ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={sickData.restChecklist.lying ? C.green : C.textTertiary}
            />
          </Pressable>
        </View>

        {/* Level 4 — Recovery tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Things that may help</Text>
          <View style={styles.toolGrid}>
            {([
              { id: "temperature" as const, icon: "thermometer-outline" as const, title: "Temperature", body: "Log a reading" },
              { id: "hydration" as const, icon: "water-outline" as const, title: "Hydration", body: "Track fluids" },
              { id: "food" as const, icon: "restaurant-outline" as const, title: "Food", body: "Log a meal" },
              { id: "rest" as const, icon: "bed-outline" as const, title: "Rest", body: "Record rest" },
            ]).map((tool) => (
              <Pressable
                key={tool.id}
                style={styles.toolCard}
                onPress={() => {
                  if (tool.id === "food") { toggleFood(); return; }
                  if (tool.id === "rest") { toggleRest(); return; }
                  setActiveTool(tool.id);
                  setExpandedCare(tool.id === "temperature" ? "temp" : "hydration");
                }}
                accessibilityRole="button"
                accessibilityLabel={tool.title}
              >
                <Ionicons name={tool.icon} size={22} color={C.text} />
                <Text style={styles.toolTitle}>{tool.title}</Text>
                <Text style={styles.toolBody}>{tool.body}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={styles.helpCard}
          onPress={() => setActiveTool(activeTool === "help" ? null : "help")}
          accessibilityRole="button"
          accessibilityLabel="When to get medical help"
        >
          <Ionicons name="alert-circle-outline" size={22} color={C.orange} />
          <View style={{ flex: 1 }}>
            <Text style={styles.helpTitle}>When to get medical help</Text>
            <Text style={styles.helpBody}>
              Open for emergency guidance and when to seek care.
            </Text>
          </View>
          <Ionicons name={activeTool === "help" ? "chevron-up" : "chevron-forward"} size={18} color={C.textTertiary} />
        </Pressable>
        {activeTool === "help" ? (
          <View style={styles.helpExpand}>
            <Text style={styles.helpExpandText}>
              Seek emergency care now for severe symptoms, inability to keep fluids down, confusion, trouble breathing, or if you have adrenal insufficiency and suspect an adrenal crisis — follow your personal emergency plan and call emergency services.
            </Text>
            <Text style={styles.helpExpandText}>
              Contact your clinician for fever at or above 102°F, worsening symptoms, or if you’re not improving as expected.
            </Text>
            <Text style={styles.helpExpandMuted}>
              This is general guidance, not a diagnosis. It does not replace your clinician’s instructions.
            </Text>
            {onNavigate ? (
              <Pressable style={styles.linkBtn} onPress={() => onNavigate("emergencyhub")}>
                <Text style={styles.linkBtnText}>Open Emergency card</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={styles.moreToggle}
          onPress={() => setShowMoreTools((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showMoreTools }}
        >
          <Text style={styles.moreToggleText}>More recovery tools</Text>
          <Ionicons name={showMoreTools ? "chevron-up" : "chevron-down"} size={16} color={C.textSecondary} />
        </Pressable>

        {showMoreTools ? (
          <View style={styles.morePanel}>
            {(sickData.temperatures || []).length > 0 ? (
              <View style={styles.historyBlock}>
                <Text style={styles.historyTitle}>Temperature history</Text>
                {(sickData.temperatures || []).slice(-6).reverse().map((t, i) => (
                  <View key={`${t.time}-${i}`} style={styles.historyRow}>
                    <Text style={styles.historyTime}>{t.time}</Text>
                    <Text style={styles.historyValue}>{t.value}°F</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {withinComfort && comfortItems.length > 0 ? (
              <View style={styles.historyBlock}>
                <Text style={styles.historyTitle}>Comfort suggestions</Text>
                {comfortItems.map((item) => (
                  <Text key={item.id} style={styles.comfortLine}>• {item.label}</Text>
                ))}
              </View>
            ) : null}
            {sickData.startedAt ? (
              <Text style={styles.sessionMeta}>
                Session started {new Date(sickData.startedAt).toLocaleString()}
              </Text>
            ) : null}
            {!isRecovery ? (
              <Pressable style={styles.secondaryAction} onPress={markFeelingBetter}>
                <Text style={styles.secondaryActionText}>I’m feeling better</Text>
              </Pressable>
            ) : null}
            {onNavigate ? (
              <Pressable style={styles.secondaryAction} onPress={() => onNavigate("medications")}>
                <Text style={styles.secondaryActionText}>Open Medications</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={styles.endBtn}
          onPress={handleEndSickMode}
          accessibilityRole="button"
          accessibilityLabel="End Sick Mode"
        >
          <Text style={styles.endBtnText}>End Sick Mode</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showCheckInModal} transparent animationType="fade" onRequestClose={skipCheckIn}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How are you feeling?</Text>
            <Text style={styles.modalSubtitle}>A short check-in — temperature is optional.</Text>
            <View style={styles.feelingRow}>
              {([
                { id: "better" as const, label: "Better" },
                { id: "same" as const, label: "About the same" },
                { id: "worse" as const, label: "Worse" },
              ]).map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[styles.feelingChip, checkInFeeling === opt.id && styles.feelingChipActive]}
                  onPress={() => setCheckInFeeling(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: checkInFeeling === opt.id }}
                >
                  <Text style={[styles.feelingChipText, checkInFeeling === opt.id && styles.feelingChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalFieldLabel}>Temperature (°F) — optional</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 100.2"
              placeholderTextColor={C.textTertiary}
              value={checkInTemp}
              onChangeText={setCheckInTemp}
              keyboardType="decimal-pad"
            />
            <Text style={styles.modalFieldLabel}>Note — optional</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 64, textAlignVertical: "top" }]}
              placeholder="Anything you want to remember"
              placeholderTextColor={C.textTertiary}
              value={checkInNote}
              onChangeText={setCheckInNote}
              multiline
            />
            <Pressable
              style={[styles.modalSubmitBtn, !checkInFeeling && { opacity: 0.4 }]}
              onPress={handleCheckInSubmit}
              disabled={!checkInFeeling}
              accessibilityRole="button"
              accessibilityLabel="Save check-in"
            >
              <Text style={styles.modalSubmitBtnText}>Save check-in</Text>
            </Pressable>
            <Pressable style={styles.modalSkipBtn} onPress={skipCheckIn} accessibilityRole="button" accessibilityLabel="Skip check-in">
              <Text style={styles.modalSkipBtnText}>Remind me later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: Theme, S: import("@/constants/sick-mode-colors").SickModePalette) {
  const solidModalSurface = modalSurface(C);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 24 },
    statusHeader: { marginBottom: 18 },
    statusChip: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 12,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: S.accent },
    statusChipText: { fontWeight: "700", fontSize: 12, color: C.textSecondary, letterSpacing: 0.2 },
    heroTitle: { fontWeight: "800", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 6 },
    heroSubtitle: { fontWeight: "500", fontSize: 15, color: C.textSecondary, lineHeight: 22 },
    heroMeta: { fontWeight: "500", fontSize: 13, color: C.textTertiary, marginTop: 8 },
    activatedMsg: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: C.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    activatedText: { flex: 1, fontWeight: "500", fontSize: 13, color: C.textSecondary },
    nextCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 20,
      marginBottom: 22,
      borderWidth: 1,
      borderColor: C.border,
      ...raised("sm"),
    },
    nextEyebrow: {
      fontWeight: "700",
      fontSize: 12,
      color: C.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    nextTitle: { fontWeight: "800", fontSize: 22, color: C.text, letterSpacing: -0.3, marginBottom: 6 },
    nextBody: { fontWeight: "500", fontSize: 15, color: C.textSecondary, lineHeight: 21, marginBottom: 16 },
    nextPrimaryBtn: {
      minHeight: 52,
      borderRadius: 999,
      backgroundColor: C.text,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 18,
    },
    nextPrimaryBtnQuiet: {
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
    },
    nextPrimaryText: { fontWeight: "700", fontSize: 16, color: "#fff" },
    nextPrimaryTextQuiet: { color: C.text },
    nextMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
    nextMeta: { fontWeight: "500", fontSize: 13, color: C.textTertiary },
    section: { marginBottom: 22 },
    sectionTitle: { fontWeight: "800", fontSize: 18, color: C.text, marginBottom: 6 },
    sectionHint: { fontWeight: "500", fontSize: 13, color: C.textSecondary, lineHeight: 18, marginBottom: 12 },
    careRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: C.border,
    },
    careRowTitle: { fontWeight: "700", fontSize: 15, color: C.text },
    careRowBody: { fontWeight: "500", fontSize: 13, color: C.textSecondary, marginTop: 2, lineHeight: 18 },
    expandPanel: { marginBottom: 10, marginTop: -2, paddingHorizontal: 4 },
    inlineLogRow: { flexDirection: "row", gap: 8 },
    inlineInput: {
      flex: 1,
      fontWeight: "500",
      fontSize: 15,
      color: C.text,
      backgroundColor: C.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    inlineSave: {
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: C.tint,
      justifyContent: "center",
    },
    inlineSaveText: { fontWeight: "700", fontSize: 14, color: "#fff" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
    },
    chipText: { fontWeight: "700", fontSize: 13, color: C.text },
    stressCard: {
      backgroundColor: C.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: C.border,
      ...raised("sm"),
    },
    stressHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
    stressTitle: { fontWeight: "700", fontSize: 17, color: C.text },
    stressDose: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginTop: 2 },
    stressDetail: { fontWeight: "500", fontSize: 13, color: C.textSecondary, marginBottom: 4, lineHeight: 18 },
    stressLogged: { fontWeight: "500", fontSize: 12, color: C.textTertiary, marginTop: 8, marginBottom: 12 },
    recordDoseBtn: {
      minHeight: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
    },
    recordDoseBtnText: { fontWeight: "700", fontSize: 15, color: C.text },
    toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    toolCard: {
      width: "48%",
      flexGrow: 1,
      minWidth: "46%",
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: C.border,
      gap: 4,
    },
    toolTitle: { fontWeight: "700", fontSize: 15, color: C.text, marginTop: 6 },
    toolBody: { fontWeight: "500", fontSize: 12, color: C.textSecondary },
    helpCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: C.border,
    },
    helpTitle: { fontWeight: "700", fontSize: 15, color: C.text },
    helpBody: { fontWeight: "500", fontSize: 13, color: C.textSecondary, marginTop: 2 },
    helpExpand: {
      backgroundColor: C.surfaceElevated,
      borderRadius: 14,
      padding: 14,
      marginBottom: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: C.border,
    },
    helpExpandText: { fontWeight: "500", fontSize: 14, color: C.text, lineHeight: 20 },
    helpExpandMuted: { fontWeight: "500", fontSize: 12, color: C.textTertiary, lineHeight: 18, fontStyle: "italic" },
    linkBtn: { alignSelf: "flex-start", paddingVertical: 8 },
    linkBtnText: { fontWeight: "700", fontSize: 14, color: C.tint },
    moreToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      marginBottom: 8,
    },
    moreToggleText: { fontWeight: "700", fontSize: 15, color: C.textSecondary },
    morePanel: { marginBottom: 16, gap: 12 },
    historyBlock: {
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    historyTitle: { fontWeight: "700", fontSize: 13, color: C.textSecondary, marginBottom: 8 },
    historyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
    historyTime: { fontWeight: "500", fontSize: 13, color: C.textSecondary },
    historyValue: { fontWeight: "700", fontSize: 13, color: C.text },
    comfortLine: { fontWeight: "500", fontSize: 14, color: C.text, marginBottom: 4 },
    sessionMeta: { fontWeight: "500", fontSize: 12, color: C.textTertiary },
    secondaryAction: {
      minHeight: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
    },
    secondaryActionText: { fontWeight: "700", fontSize: 14, color: C.text },
    endBtn: {
      marginTop: 8,
      marginBottom: 12,
      minHeight: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: C.border,
    },
    endBtnText: { fontWeight: "600", fontSize: 15, color: C.textSecondary },
    modalOverlay: {
      flex: 1,
      backgroundColor: modalOverlay(),
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalContent: {
      backgroundColor: solidModalSurface,
      borderRadius: 22,
      padding: 24,
      borderWidth: 1,
      borderColor: C.border,
      width: "100%",
      maxWidth: 400,
    },
    modalTitle: { fontWeight: "800", fontSize: 22, color: C.text, marginBottom: 6 },
    modalSubtitle: { fontWeight: "500", fontSize: 14, color: C.textSecondary, marginBottom: 16, lineHeight: 20 },
    feelingRow: { gap: 8, marginBottom: 16 },
    feelingChip: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    feelingChipActive: { borderColor: C.text, backgroundColor: C.surface },
    feelingChipText: { fontWeight: "700", fontSize: 15, color: C.textSecondary },
    feelingChipTextActive: { color: C.text },
    modalFieldLabel: { fontWeight: "600", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
    modalInput: {
      width: "100%",
      fontWeight: "500",
      fontSize: 16,
      color: C.text,
      backgroundColor: C.surfaceElevated,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 12,
    },
    modalSubmitBtn: {
      width: "100%",
      backgroundColor: C.text,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 10,
      marginTop: 4,
    },
    modalSubmitBtnText: { fontWeight: "700", fontSize: 16, color: C.background === "#000000" ? "#fff" : "#fff" },
    modalSkipBtn: { paddingVertical: 8, alignItems: "center" },
    modalSkipBtnText: { fontWeight: "500", fontSize: 14, color: C.textTertiary },
  });
}

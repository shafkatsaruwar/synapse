import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Platform, useWindowDimensions, Animated, Alert, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  medicationStorage, medicationLogStorage, settingsStorage, sickModeStorage,
  type Medication, type MedicationLog, type SickModeData,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";
import { useAccessibility } from "@/lib/accessibility";

const C = Colors.dark;
const HYDRATION_GOAL = 2000;
const CHECK_IN_INTERVAL_MS = 2 * 60 * 60 * 1000;

interface SickModeScreenProps {
  onDeactivate: () => void;
  onRefreshKey?: number;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function SickModeScreen({ onDeactivate, onRefreshKey }: SickModeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const today = getToday();
  const { reduceMotion } = useAccessibility();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [sickData, setSickData] = useState<SickModeData | null>(null);
  const [tempInput, setTempInput] = useState("");
  const [showActivated, setShowActivated] = useState(false);
  const activatedOpacity = useRef(new Animated.Value(1)).current;

  const [checkInCountdown, setCheckInCountdown] = useState<number>(0);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInTemp, setCheckInTemp] = useState("");
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    const [meds, logs, sd] = await Promise.all([
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
      sickModeStorage.get(),
    ]);
    setMedications(meds.filter(m => m.active));
    setMedLogs(logs);

    if (sd.startedAt && !sd.checkInTimer) {
      const checkInTime = new Date(new Date(sd.startedAt).getTime() + CHECK_IN_INTERVAL_MS).toISOString();
      const updated = { ...sd, checkInTimer: checkInTime };
      await sickModeStorage.save(updated);
      setSickData(updated);
    } else {
      setSickData(sd);
    }

    if (sd.startedAt) {
      const startTime = new Date(sd.startedAt).getTime();
      const now = Date.now();
      if (now - startTime < 5000) {
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
  }, [today]);

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

  const handleCheckInSubmit = async () => {
    const val = parseFloat(checkInTemp);
    if (isNaN(val) || !sickData) return;

    const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const updatedTemps = [...(sickData.temperatures || []), { time, value: val }];

    if (val < 99) {
      const updated: SickModeData = {
        ...sickData,
        recoveryMode: true,
        checkInTimer: undefined,
        lastCheckIn: new Date().toISOString(),
        temperatures: updatedTemps,
      };
      await sickModeStorage.save(updated);
      setSickData(updated);
      setShowCheckInModal(false);
      setCheckInTemp("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (val >= 102) {
      const updated: SickModeData = {
        ...sickData,
        checkInTimer: new Date(Date.now() + CHECK_IN_INTERVAL_MS).toISOString(),
        lastCheckIn: new Date().toISOString(),
        temperatures: updatedTemps,
      };
      await sickModeStorage.save(updated);
      setSickData(updated);
      setShowCheckInModal(false);
      setCheckInTemp("");
      Alert.alert(
        "High Fever Detected",
        "Your temperature is " + val + "°F. Please contact a doctor ASAP.",
        [{ text: "OK" }]
      );
    } else {
      const updated: SickModeData = {
        ...sickData,
        checkInTimer: new Date(Date.now() + CHECK_IN_INTERVAL_MS).toISOString(),
        lastCheckIn: new Date().toISOString(),
        temperatures: updatedTemps,
      };
      await sickModeStorage.save(updated);
      setSickData(updated);
      setShowCheckInModal(false);
      setCheckInTemp("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const stressMeds = medications.filter(m => m.hasStressDose);

  const getStressDosesTakenToday = (medId: string) =>
    medLogs.filter(l => l.medicationId === medId && l.taken).length;

  const handleStressDoseLog = async (med: Medication) => {
    const takenCount = getStressDosesTakenToday(med.id);
    await medicationLogStorage.toggle(med.id, today, takenCount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadData();
  };

  const addHydration = async (ml: number) => {
    if (!sickData) return;
    const updated = { ...sickData, hydrationMl: sickData.hydrationMl + ml };
    await sickModeStorage.save(updated);
    setSickData(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleFood = async () => {
    if (!sickData) return;
    const updated = { ...sickData, foodChecklist: { ...sickData.foodChecklist, lightMeal: !sickData.foodChecklist.lightMeal } };
    await sickModeStorage.save(updated);
    setSickData(updated);
    Haptics.selectionAsync();
  };

  const toggleRest = async () => {
    if (!sickData) return;
    const updated = { ...sickData, restChecklist: { ...sickData.restChecklist, lying: !sickData.restChecklist.lying } };
    await sickModeStorage.save(updated);
    setSickData(updated);
    Haptics.selectionAsync();
  };

  const addTemperature = async () => {
    const val = parseFloat(tempInput);
    if (isNaN(val) || !sickData) return;
    const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const updated = { ...sickData, temperatures: [...(sickData.temperatures || []), { time, value: val }] };
    await sickModeStorage.save(updated);
    setSickData(updated);
    setTempInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleImBetter = async () => {
    const settings = await settingsStorage.get();
    await settingsStorage.save({ ...settings, sickMode: false });
    await sickModeStorage.reset();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDeactivate();
  };

  const completedActions = [
    sickData && sickData.hydrationMl >= 250,
    sickData?.foodChecklist.lightMeal,
    stressMeds.length > 0 && stressMeds.every(m => getStressDosesTakenToday(m.id) > 0),
    sickData?.restChecklist.lying,
    sickData && (sickData.temperatures || []).length > 0,
  ].filter(Boolean).length;
  const totalActions = stressMeds.length > 0 ? 5 : 4;

  const latestTemp = sickData?.temperatures?.slice(-1)[0];
  const isRecovery = sickData?.recoveryMode === true;

  if (!sickData) return null;

  const accentColor = isRecovery ? C.green : C.red;
  const accentLight = isRecovery ? "rgba(45,125,70,0.12)" : "rgba(255,69,58,0.15)";
  const accentBorder = isRecovery ? "rgba(45,125,70,0.3)" : "rgba(255,69,58,0.3)";
  const bgColor = isRecovery ? "#E0F2E9" : "#F5D5D0";

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, {
          paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
          paddingBottom: isWide ? 60 : (Platform.OS === "web" ? 140 : insets.bottom + 120),
        }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.warningHeader, { backgroundColor: accentLight, borderColor: accentBorder }]}>
          <View style={[styles.warningIcon, { backgroundColor: accentColor }]}>
            <Ionicons name={isRecovery ? "leaf" : "warning"} size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>{isRecovery ? "Recovery Mode" : "Sick Mode Active"}</Text>
            <Text style={[styles.warningSubtitle, { color: accentColor }]}>
              {isRecovery ? "You're on the mend" : "Focus on recovery"}
            </Text>
          </View>
          {latestTemp && (
            <View style={[styles.latestTemp, latestTemp.value >= 100 && styles.latestTempHigh]}>
              <Text style={[styles.latestTempText, latestTemp.value >= 100 && { color: C.red }]}>{latestTemp.value}°F</Text>
            </View>
          )}
        </View>

        {showActivated && (
          <Animated.View style={[styles.activatedMsg, { opacity: activatedOpacity }]}>
            <Ionicons name="shield-checkmark" size={16} color={C.red} />
            <Text style={styles.activatedText}>Sick Mode activated. Focus on recovery.</Text>
          </Animated.View>
        )}

        {!isRecovery && sickData.checkInTimer && checkInCountdown > 0 && (
          <View style={styles.checkInCountdownCard}>
            <View style={styles.checkInCountdownHeader}>
              <Ionicons name="timer-outline" size={20} color={C.orange} />
              <Text style={styles.checkInCountdownLabel}>Next Check-in</Text>
            </View>
            <Text style={styles.checkInCountdownTime}>{formatCountdown(checkInCountdown)}</Text>
            <Text style={styles.checkInCountdownHint}>We'll ask how you're feeling</Text>
          </View>
        )}

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Recovery Progress</Text>
            <Text style={[styles.progressCount, { color: accentColor === C.red ? C.green : accentColor }]}>{completedActions}/{totalActions}</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(completedActions / totalActions) * 100}%` }]} />
          </View>
        </View>

        {stressMeds.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.checklistTitle}>Stress Dosing</Text>
            <Text style={styles.stressSectionSubtext}>
              You have stress dosing instructions for {stressMeds.length} medication{stressMeds.length > 1 ? "s" : ""}.
            </Text>
            {stressMeds.map(med => {
              const takenToday = getStressDosesTakenToday(med.id);
              return (
                <View key={med.id} style={[styles.stressCard, isRecovery && { backgroundColor: "rgba(45,125,70,0.08)", borderColor: "rgba(45,125,70,0.25)" }]}>
                  <View style={styles.stressHeader}>
                    <Ionicons name="flash" size={24} color={isRecovery ? C.green : C.orange} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stressTitle}>{med.name}</Text>
                      {med.stressDoseAmount ? (
                        <Text style={[styles.stressDose, { color: isRecovery ? C.green : C.red }]}>
                          {med.stressDoseAmount}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.stressBadge, isRecovery && { backgroundColor: C.green }]}>
                      <Text style={styles.stressBadgeText}>STRESS</Text>
                    </View>
                  </View>
                  {med.stressDoseFrequency ? (
                    <View style={styles.stressDetailRow}>
                      <Ionicons name="time-outline" size={14} color={C.textSecondary} />
                      <Text style={styles.stressDetailText}>{med.stressDoseFrequency}</Text>
                    </View>
                  ) : null}
                  {med.stressDoseDurationDays ? (
                    <View style={styles.stressDetailRow}>
                      <Ionicons name="calendar-outline" size={14} color={C.textSecondary} />
                      <Text style={styles.stressDetailText}>For {med.stressDoseDurationDays} day{med.stressDoseDurationDays > 1 ? "s" : ""}</Text>
                    </View>
                  ) : null}
                  {med.stressDoseInstructions ? (
                    <View style={styles.stressDetailRow}>
                      <Ionicons name="information-circle-outline" size={14} color={C.textSecondary} />
                      <Text style={styles.stressDetailText}>{med.stressDoseInstructions}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.stressDoseCount}>{takenToday} stress dose{takenToday !== 1 ? "s" : ""} logged today</Text>
                  <Pressable
                    style={[styles.stressTakeBtn, isRecovery && { backgroundColor: C.green }]}
                    onPress={() => handleStressDoseLog(med)}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark stress dose taken for ${med.name}, ${takenToday} taken today`}
                  >
                    <Ionicons name="medkit" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.stressTakeBtnText}>Dose taken</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.tempSection}>
          <View style={styles.tempHeader}>
            <Ionicons name="thermometer-outline" size={18} color={isRecovery ? C.green : C.orange} />
            <Text style={styles.tempTitle}>Temperature</Text>
          </View>
          <View style={styles.tempInputRow}>
            <TextInput
              style={styles.tempInput}
              placeholder="Enter °F"
              placeholderTextColor={C.textTertiary}
              value={tempInput}
              onChangeText={setTempInput}
              keyboardType="decimal-pad"
              accessibilityLabel="Temperature in Fahrenheit"
            />
            <Pressable style={[styles.tempLogBtn, !tempInput.trim() && { opacity: 0.4 }]} onPress={addTemperature} disabled={!tempInput.trim()} accessibilityRole="button" accessibilityLabel="Log temperature">
              <Text style={styles.tempLogBtnText}>Log</Text>
            </Pressable>
          </View>
          {(sickData.temperatures || []).length > 0 && (
            <View style={styles.tempHistory}>
              {(sickData.temperatures || []).slice(-4).reverse().map((t, i) => (
                <View key={i} style={styles.tempRow}>
                  <Text style={styles.tempTime}>{t.time}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="thermometer-outline" size={14} color={t.value >= 102 ? C.red : t.value >= 100 ? C.orange : C.green} />
                    <Text style={[styles.tempValue, t.value >= 100 && { color: t.value >= 102 ? C.red : C.orange }]}>
                      {t.value}°F
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "500" as const, color: t.value >= 102 ? C.red : t.value >= 100 ? C.orange : C.green }}>
                      {t.value >= 102 ? "High Fever" : t.value >= 100 ? "Fever" : "Normal"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.checklistTitle}>
          {isRecovery ? "Keep It Up" : "Recovery Checklist"}
        </Text>

        <Pressable style={styles.actionCard} onPress={() => addHydration(250)} accessibilityRole="button" accessibilityLabel={`${isRecovery ? "Stay hydrated" : "Hydrate"}, ${sickData.hydrationMl} of ${HYDRATION_GOAL} millilitres`}>
          <Ionicons name="water-outline" size={24} color={isRecovery ? C.cyan : "#4A90D9"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>{isRecovery ? "Stay hydrated" : "Hydrate"}</Text>
            <Text style={styles.actionMeta}>{sickData.hydrationMl} / {HYDRATION_GOAL} mL</Text>
          </View>
          {sickData.hydrationMl >= 250 ? (
            <Ionicons name="checkmark-circle" size={24} color={C.green} />
          ) : (
            <View style={styles.actionTap}>
              <Text style={styles.actionTapText}>+250mL</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={styles.actionCard} onPress={toggleFood} accessibilityRole="checkbox" accessibilityState={{ checked: sickData.foodChecklist.lightMeal }} accessibilityLabel={isRecovery ? "Nourish yourself" : "Eat food"}>
          <Ionicons name="restaurant-outline" size={24} color={isRecovery ? C.cyan : "#E8A838"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>{isRecovery ? "Nourish yourself" : "Eat food"}</Text>
            <Text style={styles.actionMeta}>{isRecovery ? "A balanced meal helps recovery" : "Log a small meal or snack"}</Text>
          </View>
          <Ionicons
            name={sickData.foodChecklist.lightMeal ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={sickData.foodChecklist.lightMeal ? C.green : C.textTertiary}
          />
        </Pressable>

        <Pressable style={styles.actionCard} onPress={toggleRest} accessibilityRole="checkbox" accessibilityState={{ checked: sickData.restChecklist.lying }} accessibilityLabel={isRecovery ? "Get some rest" : "Rest"}>
          <Ionicons name="bed-outline" size={24} color={isRecovery ? C.cyan : "#7B68AE"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>{isRecovery ? "Get some rest" : "Rest"}</Text>
            <Text style={styles.actionMeta}>{sickData.restChecklist.lying ? "Resting" : isRecovery ? "Your body still needs rest" : "Start resting"}</Text>
          </View>
          <Ionicons
            name={sickData.restChecklist.lying ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={sickData.restChecklist.lying ? C.green : C.textTertiary}
          />
        </Pressable>

        <Pressable style={styles.actionCard} onPress={() => {}}>
          <Ionicons name="thermometer-outline" size={24} color={isRecovery ? C.cyan : "#CC6600"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Check temperature</Text>
            <Text style={styles.actionMeta}>
              {(sickData.temperatures || []).length > 0
                ? `Last: ${sickData.temperatures.slice(-1)[0].value}°F`
                : "Log a reading above"}
            </Text>
          </View>
          {(sickData.temperatures || []).length > 0 ? (
            <Ionicons name="checkmark-circle" size={24} color={C.green} />
          ) : (
            <Ionicons name="ellipse-outline" size={24} color={C.textTertiary} />
          )}
        </Pressable>

        <Pressable style={[styles.betterBtn, isRecovery && { backgroundColor: C.cyan }]} onPress={handleImBetter} accessibilityRole="button" accessibilityLabel={isRecovery ? "I'm all better" : "I'm better"} accessibilityHint="Deactivates sick mode and resets recovery protocol">
          <Text style={styles.betterBtnText}>{isRecovery ? "I'm all better" : "I'm better"}</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showCheckInModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconRow}>
              <Ionicons name="medical" size={28} color={C.tint} />
            </View>
            <Text style={styles.modalTitle}>How are you feeling now?</Text>
            <Text style={styles.modalSubtitle}>It's been 2 hours. Let's check your temperature.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter temperature (°F)"
              placeholderTextColor={C.textTertiary}
              value={checkInTemp}
              onChangeText={setCheckInTemp}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Pressable
              style={[styles.modalSubmitBtn, !checkInTemp.trim() && { opacity: 0.4 }]}
              onPress={handleCheckInSubmit}
              disabled={!checkInTemp.trim()}
              accessibilityRole="button"
              accessibilityLabel="Submit temperature check-in"
            >
              <Text style={styles.modalSubmitBtnText}>Submit</Text>
            </Pressable>
            <Pressable style={styles.modalSkipBtn} onPress={() => setShowCheckInModal(false)} accessibilityRole="button" accessibilityLabel="Skip check-in">
              <Text style={styles.modalSkipBtnText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5D5D0" },
  content: { paddingHorizontal: 24 },
  warningHeader: {
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20,
    backgroundColor: "rgba(255,69,58,0.15)", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,69,58,0.3)",
  },
  warningIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: C.red,
    alignItems: "center", justifyContent: "center",
  },
  warningTitle: { fontWeight: "700", fontSize: 20, color: C.text, letterSpacing: -0.3 },
  warningSubtitle: { fontWeight: "400", fontSize: 13, color: C.red, marginTop: 2 },
  latestTemp: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.orangeLight },
  latestTempHigh: { backgroundColor: C.redLight },
  latestTempText: { fontWeight: "700", fontSize: 15, color: C.orange },
  activatedMsg: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,69,58,0.08)", borderRadius: 10, padding: 12, marginBottom: 16,
  },
  activatedText: { fontWeight: "500", fontSize: 13, color: C.red },

  checkInCountdownCard: {
    backgroundColor: C.orangeLight, borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: "rgba(204,102,0,0.25)", alignItems: "center",
  },
  checkInCountdownHeader: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8,
  },
  checkInCountdownLabel: { fontWeight: "600", fontSize: 13, color: C.orange },
  checkInCountdownTime: { fontWeight: "700", fontSize: 32, color: C.text, letterSpacing: -1 },
  checkInCountdownHint: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 4 },

  progressSection: { marginBottom: 20 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontWeight: "600", fontSize: 13, color: C.textSecondary },
  progressCount: { fontWeight: "700", fontSize: 13, color: C.green },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: C.surfaceElevated, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: C.green },
  stressCard: {
    backgroundColor: "rgba(255,69,58,0.08)", borderRadius: 16, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: "rgba(255,69,58,0.25)",
  },
  stressHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  stressTitle: { fontWeight: "700", fontSize: 17, color: C.text },
  stressDose: { fontWeight: "400", fontSize: 12, color: C.red, marginTop: 2 },
  stressBadge: { backgroundColor: C.red, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  stressBadgeText: { fontWeight: "700", fontSize: 10, color: "#fff", letterSpacing: 1 },
  stressSectionSubtext: { fontWeight: "400", fontSize: 13, color: C.textSecondary, marginBottom: 12 },
  stressDetailRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  stressDetailText: { fontWeight: "400", fontSize: 13, color: C.textSecondary, flex: 1 },
  stressDoseCount: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginBottom: 12, marginTop: 4 },
  stressTakeBtn: {
    backgroundColor: C.red, borderRadius: 12, paddingVertical: 14, alignItems: "center",
    flexDirection: "row", justifyContent: "center",
  },
  stressTakeBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
  stressDoneRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  stressDoneText: { fontWeight: "600", fontSize: 14, color: C.green },
  tempSection: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: C.border,
  },
  tempHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  tempTitle: { fontWeight: "600", fontSize: 15, color: C.text },
  tempInputRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  tempInput: {
    flex: 1, fontWeight: "400", fontSize: 14, color: C.text,
    backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  tempLogBtn: { paddingHorizontal: 20, borderRadius: 10, backgroundColor: C.tint, justifyContent: "center" },
  tempLogBtnText: { fontWeight: "600", fontSize: 14, color: "#fff" },
  tempHistory: { gap: 2 },
  tempRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tempTime: { fontWeight: "400", fontSize: 13, color: C.textSecondary },
  tempValue: { fontWeight: "600", fontSize: 14, color: C.text },
  checklistTitle: {
    fontWeight: "600", fontSize: 13, color: C.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
  },
  actionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  actionLabel: { fontWeight: "600", fontSize: 15, color: C.text },
  actionMeta: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  actionTap: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.tintLight },
  actionTapText: { fontWeight: "600", fontSize: 13, color: C.tint },
  countdownBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.orangeLight,
  },
  countdownText: { fontWeight: "600", fontSize: 12, color: C.orange },
  betterBtn: {
    marginTop: 24, backgroundColor: C.green, borderRadius: 14, paddingVertical: 16,
    alignItems: "center",
  },
  betterBtnText: { fontWeight: "700", fontSize: 16, color: "#fff" },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalContent: {
    backgroundColor: C.background, borderRadius: 20, padding: 28,
    width: "100%", maxWidth: 360, alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 12 },
      default: {},
    }),
  },
  modalIconRow: { marginBottom: 16 },
  modalTitle: { fontWeight: "700", fontSize: 20, color: C.text, textAlign: "center", marginBottom: 6 },
  modalSubtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary, textAlign: "center", marginBottom: 20 },
  modalInput: {
    width: "100%", fontWeight: "500", fontSize: 18, color: C.text, textAlign: "center",
    backgroundColor: C.surfaceElevated, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  modalSubmitBtn: {
    width: "100%", backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginBottom: 10,
  },
  modalSubmitBtnText: { fontWeight: "600", fontSize: 16, color: "#fff" },
  modalSkipBtn: { paddingVertical: 8 },
  modalSkipBtnText: { fontWeight: "500", fontSize: 14, color: C.textTertiary },
});

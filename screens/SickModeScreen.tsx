import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Platform, useWindowDimensions, Animated,
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

const C = Colors.dark;
const HYDRATION_GOAL = 2000;

interface SickModeScreenProps {
  onDeactivate: () => void;
  onRefreshKey?: number;
}

export default function SickModeScreen({ onDeactivate, onRefreshKey }: SickModeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const today = getToday();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [sickData, setSickData] = useState<SickModeData | null>(null);
  const [tempInput, setTempInput] = useState("");
  const [showActivated, setShowActivated] = useState(false);
  const activatedOpacity = useRef(new Animated.Value(1)).current;

  const loadData = useCallback(async () => {
    const [meds, logs, sd] = await Promise.all([
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
      sickModeStorage.get(),
    ]);
    setMedications(meds.filter(m => m.active));
    setMedLogs(logs);
    setSickData(sd);

    if (sd.startedAt) {
      const startTime = new Date(sd.startedAt).getTime();
      const now = Date.now();
      if (now - startTime < 5000) {
        setShowActivated(true);
        setTimeout(() => {
          Animated.timing(activatedOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }).start(() => {
            setShowActivated(false);
            activatedOpacity.setValue(1);
          });
        }, 3000);
      }
    }
  }, [today]);

  useEffect(() => { loadData(); }, [loadData, onRefreshKey]);

  const hydrocortisone = medications.find(m => m.name === "Hydrocortisone");
  const hydroDoses = hydrocortisone ? (hydrocortisone.doses || 1) * 3 : 0;

  const isDoseTaken = (medId: string, doseIdx: number) =>
    medLogs.some(l => l.medicationId === medId && (l.doseIndex ?? 0) === doseIdx && l.taken);

  const handleStressDose = async () => {
    if (!hydrocortisone) return;
    for (let i = 0; i < hydroDoses; i++) {
      if (!isDoseTaken(hydrocortisone.id, i)) {
        await medicationLogStorage.toggle(hydrocortisone.id, today, i);
        break;
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadData();
  };

  const hydroTaken = hydrocortisone ? Array.from({ length: hydroDoses }, (_, i) => isDoseTaken(hydrocortisone.id, i)).filter(Boolean).length : 0;

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

  const takeTylenol = async () => {
    if (!sickData) return;
    const last = sickData.prnDoses.filter(d => d.med === "Tylenol").slice(-1)[0];
    if (last) {
      const elapsed = (Date.now() - new Date(last.time).getTime()) / 3600000;
      if (elapsed < 4) return;
    }
    const updated = { ...sickData, prnDoses: [...sickData.prnDoses, { med: "Tylenol", time: new Date().toISOString() }] };
    await sickModeStorage.save(updated);
    setSickData(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const getTylenolCountdown = (): string | null => {
    if (!sickData) return null;
    const last = sickData.prnDoses.filter(d => d.med === "Tylenol").slice(-1)[0];
    if (!last) return null;
    const elapsed = (Date.now() - new Date(last.time).getTime()) / 60000;
    if (elapsed >= 240) return null;
    const remaining = 240 - elapsed;
    const h = Math.floor(remaining / 60);
    const m = Math.floor(remaining % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const tylenolTaken = sickData ? sickData.prnDoses.filter(d => d.med === "Tylenol").length > 0 : false;
  const tylenolCountdown = getTylenolCountdown();

  const completedActions = [
    sickData && sickData.hydrationMl >= 250,
    sickData?.foodChecklist.lightMeal,
    tylenolTaken,
    sickData?.restChecklist.lying,
    sickData && (sickData.temperatures || []).length > 0,
  ].filter(Boolean).length;
  const totalActions = 5;

  const latestTemp = sickData?.temperatures?.slice(-1)[0];

  if (!sickData) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, {
          paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
          paddingBottom: isWide ? 60 : (Platform.OS === "web" ? 140 : insets.bottom + 120),
        }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.warningHeader}>
          <View style={styles.warningIcon}>
            <Ionicons name="warning" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Sick Mode Active</Text>
            <Text style={styles.warningSubtitle}>Focus on recovery</Text>
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

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Recovery Progress</Text>
            <Text style={styles.progressCount}>{completedActions}/{totalActions}</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(completedActions / totalActions) * 100}%` }]} />
          </View>
        </View>

        {hydrocortisone && (
          <View style={styles.stressCard}>
            <View style={styles.stressHeader}>
              <Text style={{ fontSize: 24 }}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.stressTitle}>Hydrocortisone</Text>
                <Text style={styles.stressDose}>
                  {hydrocortisone.dosage} × 3 = {parseFloat(hydrocortisone.dosage) * 3} {hydrocortisone.unit || "mg"} total
                </Text>
              </View>
              <View style={styles.stressBadge}>
                <Text style={styles.stressBadgeText}>STRESS</Text>
              </View>
            </View>
            <View style={styles.stressDoseTracker}>
              {Array.from({ length: hydroDoses }, (_, i) => (
                <View key={i} style={[styles.stressDot, isDoseTaken(hydrocortisone.id, i) && styles.stressDotDone]} />
              ))}
            </View>
            <Text style={styles.stressDoseCount}>{hydroTaken} of {hydroDoses} doses taken</Text>
            {hydroTaken < hydroDoses ? (
              <Pressable style={styles.stressTakeBtn} onPress={handleStressDose}>
                <Text style={styles.stressTakeBtnText}>Stress dose taken 💉</Text>
              </Pressable>
            ) : (
              <View style={styles.stressDoneRow}>
                <Ionicons name="checkmark-circle" size={18} color={C.green} />
                <Text style={styles.stressDoneText}>All stress doses taken</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.tempSection}>
          <View style={styles.tempHeader}>
            <Text style={{ fontSize: 18 }}>🌡️</Text>
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
            />
            <Pressable style={[styles.tempLogBtn, !tempInput.trim() && { opacity: 0.4 }]} onPress={addTemperature} disabled={!tempInput.trim()}>
              <Text style={styles.tempLogBtnText}>Log</Text>
            </Pressable>
          </View>
          {(sickData.temperatures || []).length > 0 && (
            <View style={styles.tempHistory}>
              {(sickData.temperatures || []).slice(-4).reverse().map((t, i) => (
                <View key={i} style={styles.tempRow}>
                  <Text style={styles.tempTime}>{t.time}</Text>
                  <Text style={[styles.tempValue, t.value >= 100 && { color: C.red }]}>
                    {t.value}°F {t.value >= 100 ? "⚠️" : "✓"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.checklistTitle}>Recovery Checklist</Text>

        <Pressable style={styles.actionCard} onPress={() => addHydration(250)}>
          <Text style={styles.actionEmoji}>💧</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Hydrate</Text>
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

        <Pressable style={styles.actionCard} onPress={toggleFood}>
          <Text style={styles.actionEmoji}>🍲</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Eat food</Text>
            <Text style={styles.actionMeta}>Log a small meal or snack</Text>
          </View>
          <Ionicons
            name={sickData.foodChecklist.lightMeal ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={sickData.foodChecklist.lightMeal ? C.green : C.textTertiary}
          />
        </Pressable>

        <Pressable style={[styles.actionCard, !!tylenolCountdown && { opacity: 0.7 }]} onPress={takeTylenol} disabled={!!tylenolCountdown}>
          <Text style={styles.actionEmoji}>💊</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Take Tylenol</Text>
            <Text style={styles.actionMeta}>
              {tylenolCountdown ? `Wait ${tylenolCountdown}` : tylenolTaken ? "Ready for next dose" : "Mark as taken"}
            </Text>
          </View>
          {tylenolTaken ? (
            <Ionicons name="checkmark-circle" size={24} color={C.green} />
          ) : tylenolCountdown ? (
            <View style={styles.countdownBadge}>
              <Ionicons name="time-outline" size={14} color={C.orange} />
              <Text style={styles.countdownText}>{tylenolCountdown}</Text>
            </View>
          ) : (
            <View style={styles.actionTap}>
              <Text style={styles.actionTapText}>Take</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={styles.actionCard} onPress={toggleRest}>
          <Text style={styles.actionEmoji}>🛌</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Rest</Text>
            <Text style={styles.actionMeta}>{sickData.restChecklist.lying ? "Resting" : "Start resting"}</Text>
          </View>
          <Ionicons
            name={sickData.restChecklist.lying ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={sickData.restChecklist.lying ? C.green : C.textTertiary}
          />
        </Pressable>

        <Pressable style={styles.actionCard} onPress={() => {}}>
          <Text style={styles.actionEmoji}>🌡️</Text>
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

        <Pressable style={styles.betterBtn} onPress={handleImBetter}>
          <Text style={styles.betterBtnText}>I'm better</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0000" },
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
  warningTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, letterSpacing: -0.3 },
  warningSubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.red, marginTop: 2 },
  latestTemp: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.orangeLight },
  latestTempHigh: { backgroundColor: C.redLight },
  latestTempText: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.orange },
  activatedMsg: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,69,58,0.08)", borderRadius: 10, padding: 12, marginBottom: 16,
  },
  activatedText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.red },
  progressSection: { marginBottom: 20 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  progressCount: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.green },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: C.surfaceElevated, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: C.green },
  stressCard: {
    backgroundColor: "rgba(255,69,58,0.08)", borderRadius: 16, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: "rgba(255,69,58,0.25)",
  },
  stressHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  stressTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: C.text },
  stressDose: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.red, marginTop: 2 },
  stressBadge: { backgroundColor: C.red, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  stressBadgeText: { fontFamily: "Inter_700Bold", fontSize: 10, color: "#fff", letterSpacing: 1 },
  stressDoseTracker: { flexDirection: "row", gap: 6, marginBottom: 8 },
  stressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(255,69,58,0.2)" },
  stressDotDone: { backgroundColor: C.green },
  stressDoseCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginBottom: 12 },
  stressTakeBtn: {
    backgroundColor: C.red, borderRadius: 12, paddingVertical: 14, alignItems: "center",
  },
  stressTakeBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  stressDoneRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  stressDoneText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.green },
  tempSection: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: C.border,
  },
  tempHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  tempTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  tempInputRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  tempInput: {
    flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, color: C.text,
    backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  tempLogBtn: { paddingHorizontal: 20, borderRadius: 10, backgroundColor: C.tint, justifyContent: "center" },
  tempLogBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
  tempHistory: { gap: 2 },
  tempRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tempTime: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  tempValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  checklistTitle: {
    fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
  },
  actionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  actionEmoji: { fontSize: 24 },
  actionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  actionMeta: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  actionTap: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.tintLight },
  actionTapText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.tint },
  countdownBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.orangeLight,
  },
  countdownText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.orange },
  betterBtn: {
    marginTop: 24, backgroundColor: C.green, borderRadius: 14, paddingVertical: 16,
    alignItems: "center",
  },
  betterBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
});

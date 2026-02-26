import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, Platform, useWindowDimensions, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { mentalHealthModeStorage, comfortStorage, type MentalHealthModeData, type ComfortItem } from "@/lib/storage";

const C = Colors.dark;
const HOURLY_CHECK_IN_MS = 60 * 60 * 1000;
const COMFORT_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface MentalHealthModeScreenProps {
  onDeactivate?: () => void;
  onRefreshKey?: number;
}

export default function MentalHealthModeScreen({ onDeactivate, onRefreshKey }: MentalHealthModeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [mhData, setMhData] = useState<MentalHealthModeData | null>(null);
  const [comfortItems, setComfortItems] = useState<ComfortItem[]>([]);
  const [whatsHappening, setWhatsHappening] = useState("");
  const [checkInCountdown, setCheckInCountdown] = useState(0);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [medsOnTimeModal, setMedsOnTimeModal] = useState<boolean | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    const [data, comfort] = await Promise.all([mentalHealthModeStorage.get(), comfortStorage.getAll()]);
    setMhData(data);
    setComfortItems(comfort);
    setWhatsHappening(data.whatsHappening ?? "");
    if (data.startedAt && !data.hourlyCheckInTimer) {
      const next = new Date(new Date(data.startedAt).getTime() + HOURLY_CHECK_IN_MS).toISOString();
      const updated = { ...data, hourlyCheckInTimer: next };
      await mentalHealthModeStorage.save(updated);
      setMhData(updated);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData, onRefreshKey]);

  useEffect(() => {
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    if (mhData?.hourlyCheckInTimer && mhData.active) {
      const tick = () => {
        const target = new Date(mhData.hourlyCheckInTimer!).getTime();
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
    return () => { if (countdownInterval.current) clearInterval(countdownInterval.current); };
  }, [mhData?.hourlyCheckInTimer, mhData?.active]);

  const saveWhatsHappening = async () => {
    if (!mhData) return;
    const updated = { ...mhData, whatsHappening: whatsHappening.trim() || undefined };
    await mentalHealthModeStorage.save(updated);
    setMhData(updated);
  };

  const handleStart = async () => {
    const updated: MentalHealthModeData = {
      active: true,
      startedAt: new Date().toISOString(),
      hourlyCheckInTimer: new Date(Date.now() + HOURLY_CHECK_IN_MS).toISOString(),
    };
    await mentalHealthModeStorage.save(updated);
    setMhData(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleCheckInSubmit = async () => {
    if (!mhData || medsOnTimeModal === null) return;
    const updated: MentalHealthModeData = {
      ...mhData,
      lastCheckIn: new Date().toISOString(),
      hourlyCheckInTimer: new Date(Date.now() + HOURLY_CHECK_IN_MS).toISOString(),
      medsOnTime: medsOnTimeModal,
    };
    await mentalHealthModeStorage.save(updated);
    setMhData(updated);
    setShowCheckInModal(false);
    setMedsOnTimeModal(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleFeelingBetter = () => {
    Alert.alert(
      "End mental health day?",
      "This will turn off hourly check-ins. You can start again anytime from More.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "I'm feeling better",
          onPress: async () => {
            await mentalHealthModeStorage.reset();
            setMhData(await mentalHealthModeStorage.get());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDeactivate?.();
          },
        },
      ]
    );
  };

  const topPad = isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16);

  if (!mhData) return <View style={styles.container} />;

  if (!mhData.active) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inactiveCard}>
          <Ionicons name="heart-outline" size={48} color={C.purple} />
          <Text style={styles.inactiveTitle}>Mental health day</Text>
          <Text style={styles.inactiveSubtitle}>
            When you need extra support, start a mental health day. We'll check in with you hourly and ask how you're doing and if your meds are on time.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.9 }]}
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel="Start mental health day"
          >
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.startBtnText}>Start mental health day</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, {
          paddingTop: topPad,
          paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
        }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="heart" size={24} color={C.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Mental health day</Text>
            <Text style={styles.subtitle}>Hourly check-ins • Take it easy</Text>
          </View>
        </View>

        {mhData.hourlyCheckInTimer && checkInCountdown > 0 && (
          <View style={styles.countdownCard}>
            <Ionicons name="time-outline" size={20} color={C.purple} />
            <Text style={styles.countdownLabel}>Next check-in</Text>
            <Text style={styles.countdownTime}>{formatCountdown(checkInCountdown)}</Text>
          </View>
        )}

        {mhData.startedAt && comfortItems.length > 0 && (Date.now() - new Date(mhData.startedAt).getTime() < COMFORT_WINDOW_MS) && (
          <View style={styles.comfortCard}>
            <Text style={styles.comfortCardTitle}>Things that might help</Text>
            {comfortItems.map((item) => (
              <View key={item.id} style={styles.comfortRow}>
                <Ionicons name="heart" size={16} color={C.purple} />
                <Text style={styles.comfortRowText}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's happening?</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Optional: note how you're feeling or what's going on"
            placeholderTextColor={C.textTertiary}
            value={whatsHappening}
            onChangeText={setWhatsHappening}
            onBlur={saveWhatsHappening}
            multiline
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meds on time?</Text>
          <View style={styles.medsRow}>
            <Pressable
              style={[styles.medsChip, mhData.medsOnTime === true && styles.medsChipYes]}
              onPress={async () => {
                if (!mhData) return;
                await mentalHealthModeStorage.save({ ...mhData, medsOnTime: true });
                setMhData(await mentalHealthModeStorage.get());
                Haptics.selectionAsync();
              }}
            >
              <Text style={[styles.medsChipText, mhData.medsOnTime === true && styles.medsChipTextActive]}>Yes</Text>
            </Pressable>
            <Pressable
              style={[styles.medsChip, mhData.medsOnTime === false && styles.medsChipNo]}
              onPress={async () => {
                if (!mhData) return;
                await mentalHealthModeStorage.save({ ...mhData, medsOnTime: false });
                setMhData(await mentalHealthModeStorage.get());
                Haptics.selectionAsync();
              }}
            >
              <Text style={[styles.medsChipText, mhData.medsOnTime === false && styles.medsChipTextActive]}>No</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.betterBtn} onPress={handleFeelingBetter} accessibilityRole="button" accessibilityLabel="I'm feeling better">
          <Text style={styles.betterBtnText}>I'm feeling better</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showCheckInModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Hourly check-in</Text>
            <Text style={styles.modalSubtitle}>Are your meds on time?</Text>
            <View style={styles.modalRow}>
              <Pressable
                style={[styles.modalBtn, medsOnTimeModal === true && styles.modalBtnYes]}
                onPress={() => setMedsOnTimeModal(true)}
              >
                <Text style={styles.modalBtnText}>Yes</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, medsOnTimeModal === false && styles.modalBtnNo]}
                onPress={() => setMedsOnTimeModal(false)}
              >
                <Text style={styles.modalBtnText}>No</Text>
              </Pressable>
            </View>
            <Pressable
              style={[styles.modalSubmitBtn, medsOnTimeModal === null && { opacity: 0.5 }]}
              onPress={handleCheckInSubmit}
              disabled={medsOnTimeModal === null}
            >
              <Text style={styles.modalSubmitBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  inactiveCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  inactiveTitle: { fontWeight: "700", fontSize: 22, color: C.text, marginTop: 16 },
  inactiveSubtitle: { fontSize: 15, color: C.textSecondary, marginTop: 8, textAlign: "center", lineHeight: 22 },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.purple,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 24,
  },
  startBtnText: { fontWeight: "600", fontSize: 16, color: "#fff" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  headerIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.purple + "22", alignItems: "center", justifyContent: "center" },
  title: { fontWeight: "700", fontSize: 24, color: C.text },
  subtitle: { fontSize: 14, color: C.textSecondary },
  countdownCard: {
    backgroundColor: C.purple + "15",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.purple + "35",
  },
  countdownLabel: { fontWeight: "600", fontSize: 13, color: C.purple, marginTop: 4 },
  countdownTime: { fontWeight: "700", fontSize: 28, color: C.text, marginTop: 4 },
  comfortCard: { backgroundColor: C.purple + "18", borderRadius: 14, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: C.purple + "40" },
  comfortCardTitle: { fontWeight: "600", fontSize: 13, color: C.purple, marginBottom: 10 },
  comfortRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  comfortRowText: { fontWeight: "500", fontSize: 14, color: C.text },
  section: { marginBottom: 20 },
  sectionTitle: { fontWeight: "600", fontSize: 14, color: C.textSecondary, marginBottom: 8 },
  input: { backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.text, borderWidth: 1, borderColor: C.border },
  textArea: { minHeight: 88, textAlignVertical: "top" },
  medsRow: { flexDirection: "row", gap: 12 },
  medsChip: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  medsChipYes: { backgroundColor: C.green + "18", borderColor: C.green + "44" },
  medsChipNo: { backgroundColor: C.orange + "18", borderColor: C.orange + "44" },
  medsChipText: { fontWeight: "600", fontSize: 16, color: C.textSecondary },
  medsChipTextActive: { color: C.text },
  betterBtn: { backgroundColor: C.purple, paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 16 },
  betterBtnText: { fontWeight: "600", fontSize: 16, color: "#fff" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalContent: { backgroundColor: C.surface, borderRadius: 20, padding: 24 },
  modalTitle: { fontWeight: "700", fontSize: 20, color: C.text, marginBottom: 8 },
  modalSubtitle: { fontSize: 15, color: C.textSecondary, marginBottom: 20 },
  modalRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: C.surfaceElevated },
  modalBtnYes: { backgroundColor: C.green + "22" },
  modalBtnNo: { backgroundColor: C.orange + "22" },
  modalBtnText: { fontWeight: "600", fontSize: 16, color: C.text },
  modalSubmitBtn: { backgroundColor: C.tint, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalSubmitBtnText: { fontWeight: "600", fontSize: 16, color: "#fff" },
});

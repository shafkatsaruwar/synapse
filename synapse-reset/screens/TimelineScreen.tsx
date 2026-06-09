import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  appointmentStorage,
  doctorsStorage,
  imagingStorage,
  labWorkStorage,
  medicationLogStorage,
  medicationStorage,
  symptomStorage,
} from "@/lib/storage";
import { buildHealthTimeline, groupTimelineByDay, type TimelineEvent, type TimelineFilter } from "@/lib/health-timeline";
import { formatDateWithYear, formatTime12h } from "@/lib/date-utils";

const FILTERS: { key: TimelineFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "appointment", label: "Appointments" },
  { key: "med", label: "Medications" },
  { key: "lab", label: "LabWork" },
  { key: "imaging", label: "Imaging" },
];

const TYPE_META: Record<TimelineEvent["type"], { label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  appointment: { label: "Appointment", icon: "calendar-outline" },
  med: { label: "Medication", icon: "medical-outline" },
  symptom: { label: "Symptom", icon: "pulse-outline" },
  lab: { label: "LabWork", icon: "flask-outline" },
  imaging: { label: "Imaging", icon: "scan-outline" },
};

export default function TimelineScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [visibleGroupCount, setVisibleGroupCount] = useState(12);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  const loadData = useCallback(async () => {
    const [appointments, medications, medicationLogs, labWork, imaging, symptoms, doctors] = await Promise.all([
      appointmentStorage.getAll(),
      medicationStorage.getAll(),
      medicationLogStorage.getAll(),
      labWorkStorage.getAll(),
      imagingStorage.getAll(),
      symptomStorage.getAll(),
      doctorsStorage.getAll(),
    ]);
    setEvents(buildHealthTimeline({ appointments, medications, medicationLogs, labWork, imaging, symptoms, doctors }));
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const filteredEvents = useMemo(
    () => filter === "all" ? events : events.filter((event) => event.type === filter),
    [events, filter],
  );

  const groups = useMemo(
    () => groupTimelineByDay(filteredEvents).slice(0, visibleGroupCount),
    [filteredEvents, visibleGroupCount],
  );

  const openEvent = (event: TimelineEvent) => {
    void Haptics.selectionAsync().catch(() => {});
    setSelectedEvent(event);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: isWide ? 40 : Platform.OS === "web" ? 67 : insets.top + 16, paddingBottom: isWide ? 40 : insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const nearBottom = nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 280;
          if (nearBottom && groups.length < groupTimelineByDay(filteredEvents).length) {
            setVisibleGroupCount((count) => count + 8);
          }
        }}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Health Timeline</Text>
            <Text style={styles.title}>Timeline</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="git-branch-outline" size={24} color={C.tint} />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
              onPress={() => {
                setFilter(item.key);
                setVisibleGroupCount(12);
                void Haptics.selectionAsync().catch(() => {});
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item.key }}
            >
              <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="git-branch-outline" size={36} color={C.textSecondary} />
            <Text style={styles.emptyTitle}>No timeline events yet</Text>
            <Text style={styles.emptyText}>Appointments, medications, lab work, imaging, and symptoms will appear here.</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {groups.map((group) => (
              <View key={group.date} style={styles.dayGroup}>
                <Text style={styles.dateHeader}>{formatDateWithYear(group.date)}</Text>
                <View style={styles.dayEvents}>
                  {group.events.map((event) => (
                    <TimelineCard key={event.id} event={event} onPress={() => openEvent(event)} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selectedEvent} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setSelectedEvent(null)}>
          <Pressable style={styles.detailModal} onPress={() => {}}>
            {selectedEvent ? (
              <>
                <View style={styles.detailHeader}>
                  <View style={styles.detailIcon}>
                    <Ionicons name={TYPE_META[selectedEvent.type].icon} size={22} color={C.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailType}>{TYPE_META[selectedEvent.type].label}</Text>
                    <Text style={styles.detailTitle}>{selectedEvent.title}</Text>
                  </View>
                  <Pressable style={styles.closeBtn} onPress={() => setSelectedEvent(null)}>
                    <Ionicons name="close" size={20} color={C.text} />
                  </Pressable>
                </View>
                {selectedEvent.subtitle ? <Text style={styles.detailSubtitle}>{selectedEvent.subtitle}</Text> : null}
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={18} color={C.textSecondary} />
                  <Text style={styles.detailRowText}>
                    {formatDateWithYear(selectedEvent.date)}
                    {selectedEvent.time ? ` · ${formatTime12h(selectedEvent.time)}` : ""}
                  </Text>
                </View>
                {selectedEvent.contextBlocks.length ? (
                  <View style={styles.contextList}>
                    {selectedEvent.contextBlocks.map((block) => (
                      <View key={block} style={styles.contextBlock}>
                        <Ionicons name="link-outline" size={15} color={C.tint} />
                        <Text style={styles.contextText}>{block}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noContextText}>No related context yet.</Text>
                )}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );

  function TimelineCard({ event, onPress }: { event: TimelineEvent; onPress: () => void }) {
    const meta = TYPE_META[event.type];
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress} accessibilityRole="button">
        <View style={styles.railDot}>
          <Ionicons name={meta.icon} size={18} color={C.tint} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.cardType}>{meta.label}</Text>
            {event.time ? <Text style={styles.cardTime}>{formatTime12h(event.time)}</Text> : null}
          </View>
          <Text style={styles.cardTitle}>{event.title}</Text>
          {event.subtitle ? <Text style={styles.cardSubtitle}>{event.subtitle}</Text> : null}
          {event.contextBlocks.slice(0, 2).map((block) => (
            <View key={block} style={styles.inlineContext}>
              <Ionicons name="link-outline" size={13} color={C.textSecondary} />
              <Text style={styles.inlineContextText}>{block}</Text>
            </View>
          ))}
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.textSecondary} />
      </Pressable>
    );
  }
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { paddingHorizontal: 22 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
    eyebrow: { color: C.textSecondary, fontSize: 13, fontWeight: "800", textTransform: "uppercase", marginBottom: 2 },
    title: { color: C.text, fontSize: 38, fontWeight: "900" },
    headerIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center" },
    filterRow: { gap: 10, paddingBottom: 18 },
    filterChip: { minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
    filterChipActive: { backgroundColor: C.tint, borderColor: C.tint },
    filterText: { color: C.textSecondary, fontSize: 13, fontWeight: "800" },
    filterTextActive: { color: "#fff" },
    emptyCard: { minHeight: 280, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
    emptyTitle: { color: C.text, fontSize: 20, fontWeight: "900" },
    emptyText: { color: C.textSecondary, fontSize: 15, textAlign: "center", lineHeight: 21 },
    timeline: { gap: 24 },
    dayGroup: { gap: 10 },
    dateHeader: { color: C.textSecondary, fontSize: 14, fontWeight: "900", textTransform: "uppercase" },
    dayEvents: { gap: 12 },
    card: { minHeight: 104, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
    cardPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    railDot: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center" },
    cardBody: { flex: 1, gap: 4 },
    cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    cardType: { color: C.textSecondary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    cardTime: { color: C.textSecondary, fontSize: 12, fontWeight: "800" },
    cardTitle: { color: C.text, fontSize: 17, fontWeight: "900" },
    cardSubtitle: { color: C.textSecondary, fontSize: 14, fontWeight: "600" },
    inlineContext: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
    inlineContextText: { color: C.textSecondary, fontSize: 12, flex: 1 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", padding: 20 },
    detailModal: { width: "100%", maxWidth: 440, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 18 },
    detailHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
    detailIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center" },
    detailType: { color: C.textSecondary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    detailTitle: { color: C.text, fontSize: 22, fontWeight: "900", marginTop: 2 },
    closeBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: C.surfaceElevated, alignItems: "center", justifyContent: "center" },
    detailSubtitle: { color: C.textSecondary, fontSize: 15, fontWeight: "700", marginBottom: 14 },
    detailRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
    detailRowText: { color: C.text, fontSize: 15, fontWeight: "700" },
    contextList: { gap: 8, marginTop: 14 },
    contextBlock: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 14, backgroundColor: C.surfaceElevated, padding: 12 },
    contextText: { color: C.text, fontSize: 14, lineHeight: 19, flex: 1 },
    noContextText: { color: C.textSecondary, fontSize: 14, marginTop: 14 },
  }) as any;
}

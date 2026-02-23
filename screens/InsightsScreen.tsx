import React, { useState, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, useWindowDimensions, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  healthLogStorage, symptomStorage, medicationStorage, medicationLogStorage, vitalStorage,
  fastingLogStorage, settingsStorage, documentStorage, insightStorage,
  type HealthInsight,
} from "@/lib/storage";
import { getHealthInsights } from "@/lib/api";
import { getToday, formatDate } from "@/lib/date-utils";

const C = Colors.dark;

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [insight, setInsight] = useState<HealthInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasData, setHasData] = useState(true);

  const loadLatest = useCallback(async () => {
    const latest = await insightStorage.getLatest();
    if (latest) setInsight(latest);
    const logs = await healthLogStorage.getAll();
    setHasData(logs.length > 0);
  }, []);

  React.useEffect(() => { loadLatest(); }, [loadLatest]);

  const generateInsights = async () => {
    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const [healthLogs, symptoms, medications, medLogs, vitals, fastingLogs, settings, documents] = await Promise.all([
        healthLogStorage.getAll(),
        symptomStorage.getAll(),
        medicationStorage.getAll(),
        medicationLogStorage.getAll(),
        vitalStorage.getAll(),
        fastingLogStorage.getAll(),
        settingsStorage.get(),
        documentStorage.getAll(),
      ]);

      const result = await getHealthInsights({
        healthLogs, symptoms, medications: medications.filter((m) => m.active), medLogs, vitals, fastingLogs,
        conditions: settings.conditions, documents,
      });

      const saved = await insightStorage.save({
        date: getToday(),
        changes: result.changes || [],
        unclear: result.unclear || [],
        labsToTrack: result.labsToTrack || [],
        symptomCorrelations: result.symptomCorrelations || [],
        medicationNotes: result.medicationNotes || [],
        ramadanTips: result.ramadanTips || [],
        summary: result.summary || "No insights available",
      });
      setInsight(saved);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to generate insights");
    } finally {
      setLoading(false);
    }
  };

  const typeIcon = (type: string): string => {
    if (type === "improvement") return "trending-up";
    if (type === "concern") return "warning-outline";
    return "information-circle-outline";
  };

  const typeColor = (type: string): string => {
    if (type === "improvement") return C.green;
    if (type === "concern") return C.orange;
    return C.tint;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, {
      paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
      paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
    }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Health Insights</Text>
      <Text style={styles.subtitle}>AI-powered analysis of your health patterns</Text>

      <Pressable style={({ pressed }) => [styles.generateBtn, { opacity: pressed ? 0.85 : 1 }, loading && { opacity: 0.6 }]} onPress={generateInsights} disabled={loading || !hasData}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="sparkles" size={18} color="#fff" />
        )}
        <Text style={styles.generateText}>{loading ? "Analyzing your data..." : "Generate New Insights"}</Text>
      </Pressable>

      {!hasData && !insight && (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color={C.textTertiary} />
          <Text style={styles.emptyTitle}>Not enough data yet</Text>
          <Text style={styles.emptySubtext}>Log a few days of health data, then come back for personalized insights</Text>
        </View>
      )}

      {insight && (
        <>
          <View style={styles.card}>
            <Text style={styles.summaryLabel}>Summary</Text>
            <Text style={styles.summaryText}>{insight.summary}</Text>
            <Text style={styles.insightDate}>Generated {formatDate(insight.date)}</Text>
          </View>

          {insight.changes.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="swap-vertical" size={18} color={C.tint} />
                <Text style={styles.cardTitle}>Changes & Trends</Text>
              </View>
              {insight.changes.map((c, i) => (
                <View key={i} style={styles.insightItem}>
                  <Ionicons name={typeIcon(c.type) as any} size={16} color={typeColor(c.type)} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insightItemTitle}>{c.title}</Text>
                    <Text style={styles.insightItemDesc}>{c.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {insight.symptomCorrelations.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="git-network-outline" size={18} color={C.purple} />
                <Text style={styles.cardTitle}>Symptom Correlations</Text>
              </View>
              {insight.symptomCorrelations.map((sc, i) => (
                <View key={i} style={styles.insightItem}>
                  <View style={[styles.confBadge, { backgroundColor: sc.confidence === "high" ? C.greenLight : sc.confidence === "medium" ? C.orangeLight : C.surfaceElevated }]}>
                    <Text style={[styles.confText, { color: sc.confidence === "high" ? C.green : sc.confidence === "medium" ? C.orange : C.textSecondary }]}>{sc.confidence}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insightItemTitle}>{sc.pattern}</Text>
                    <Text style={styles.insightItemDesc}>{sc.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {insight.unclear.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="help-circle-outline" size={18} color={C.orange} />
                <Text style={styles.cardTitle}>Things to Clarify</Text>
              </View>
              {insight.unclear.map((u, i) => (
                <View key={i} style={styles.clarifyItem}>
                  <Text style={styles.insightItemTitle}>{u.title}</Text>
                  <Text style={styles.insightItemDesc}>{u.description}</Text>
                  <View style={styles.suggestionRow}>
                    <Ionicons name="bulb-outline" size={14} color={C.yellow} />
                    <Text style={styles.suggestionText}>{u.suggestion}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {insight.labsToTrack.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="flask-outline" size={18} color={C.green} />
                <Text style={styles.cardTitle}>Labs to Track</Text>
              </View>
              {insight.labsToTrack.map((lt, i) => (
                <View key={i} style={styles.labTrackItem}>
                  <View style={styles.labTrackLeft}>
                    <Text style={styles.labTrackTest}>{lt.test}</Text>
                    <Text style={styles.insightItemDesc}>{lt.reason}</Text>
                  </View>
                  <View style={styles.freqBadge}>
                    <Text style={styles.freqText}>{lt.frequency}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {insight.medicationNotes.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="medical-outline" size={18} color={C.cyan} />
                <Text style={styles.cardTitle}>Medication Notes</Text>
              </View>
              {insight.medicationNotes.map((mn, i) => (
                <View key={i} style={styles.insightItem}>
                  <View style={[styles.medNoteBadge, { backgroundColor: mn.type === "interaction" ? C.redLight : mn.type === "timing" ? C.orangeLight : C.tintLight }]}>
                    <Text style={[styles.medNoteType, { color: mn.type === "interaction" ? C.red : mn.type === "timing" ? C.orange : C.tint }]}>{mn.type}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insightItemTitle}>{mn.medication}</Text>
                    <Text style={styles.insightItemDesc}>{mn.note}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {insight.ramadanTips.length > 0 && (
            <View style={[styles.card, { borderColor: C.orange, borderWidth: 1 }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="moon" size={18} color={C.orange} />
                <Text style={styles.cardTitle}>Ramadan Tips</Text>
              </View>
              {insight.ramadanTips.map((rt, i) => (
                <View key={i} style={styles.insightItem}>
                  <View style={[styles.ramCatBadge, { backgroundColor: rt.category === "medication" ? C.tintLight : rt.category === "hydration" ? C.cyanLight : rt.category === "energy" ? C.orangeLight : C.purpleLight }]}>
                    <Text style={[styles.ramCatText, { color: rt.category === "medication" ? C.tint : rt.category === "hydration" ? C.cyan : rt.category === "energy" ? C.orange : C.purple }]}>{rt.category}</Text>
                  </View>
                  <Text style={[styles.insightItemDesc, { flex: 1 }]}>{rt.tip}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 4, marginBottom: 20 },
  generateBtn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 },
  generateText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.textSecondary, marginTop: 12 },
  emptySubtext: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, marginTop: 4, textAlign: "center", maxWidth: 260 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  summaryLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textTertiary, marginBottom: 6 },
  summaryText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, lineHeight: 20 },
  insightDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 12 },
  insightItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  insightItemTitle: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text },
  insightItemDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2, lineHeight: 17 },
  confBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  confText: { fontFamily: "Inter_500Medium", fontSize: 10, textTransform: "uppercase" },
  clarifyItem: { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  suggestionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: C.surfaceElevated, padding: 10, borderRadius: 8 },
  suggestionText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.yellow, flex: 1 },
  labTrackItem: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  labTrackLeft: { flex: 1 },
  labTrackTest: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text },
  freqBadge: { backgroundColor: C.greenLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  freqText: { fontFamily: "Inter_500Medium", fontSize: 10, color: C.green },
  medNoteBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  medNoteType: { fontFamily: "Inter_500Medium", fontSize: 10, textTransform: "uppercase" },
  ramCatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  ramCatText: { fontFamily: "Inter_500Medium", fontSize: 10, textTransform: "uppercase" },
});

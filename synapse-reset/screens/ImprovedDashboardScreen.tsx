import React, { useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import {
  StatusCard,
  MetricCard,
  MedicationCard,
  QuickAddBottomSheet,
  ProgressRing,
  SimpleLineChart,
  EmptyState,
  LoadingState,
} from "@/components/ui";
import { UITokens, StatusColors, DataVizColors } from "@/constants/ui-design";
import { getToday } from "@/lib/date-utils";

interface ImprovedDashboardScreenProps {
  onNavigate?: (screen: string) => void;
  onRefreshKey?: number;
}

export default function ImprovedDashboardScreen({
  onNavigate,
  onRefreshKey,
}: ImprovedDashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [loading, setLoading] = useState(false);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [metrics, setMetrics] = useState({
    energy: 7,
    mood: 8,
    sleep: 6.5,
  });

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    // Simulate data refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
  }, []);

  const handleQuickAdd = (data: any) => {
    setMetrics(data);
    // Save to storage here
  };

  const medications = [
    {
      emoji: "💊",
      name: "Aspirin",
      dosage: "500mg",
      nextDoseIn: "4h 30m",
      adherencePercent: 92,
      supplyStatus: "good" as const,
    },
    {
      emoji: "💉",
      name: "Vitamin D",
      dosage: "1000 IU",
      nextDoseIn: "Tomorrow",
      adherencePercent: 85,
      supplyStatus: "warning" as const,
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor={colors.tint}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.date}>{getToday()}</Text>
          </View>
          <Pressable
            style={styles.syncButton}
            onPress={handleRefresh}
          >
            <Text style={styles.syncIcon}>↻</Text>
          </Pressable>
        </View>

        {/* Today's Metrics - Single Box */}
        <Pressable onPress={() => onNavigate?.("log")}>
          <View style={styles.section}>
            <View style={styles.metricsBox}>
              <Text style={styles.metricsBoxTitle}>Today's Metrics</Text>
              <View style={styles.metricsBoxGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricItemIcon}>⚡</Text>
                  <Text style={styles.metricItemLabel}>Energy</Text>
                  <Text style={[styles.metricItemValue, { color: metrics.energy >= 7 ? StatusColors.success : StatusColors.warning }]}>
                    {metrics.energy}
                  </Text>
                  <Text style={styles.metricItemUnit}>/10</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricItemIcon}>😊</Text>
                  <Text style={styles.metricItemLabel}>Mood</Text>
                  <Text style={[styles.metricItemValue, { color: metrics.mood >= 7 ? StatusColors.success : StatusColors.warning }]}>
                    {metrics.mood}
                  </Text>
                  <Text style={styles.metricItemUnit}>/10</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricItemIcon}>😴</Text>
                  <Text style={styles.metricItemLabel}>Sleep</Text>
                  <Text style={[styles.metricItemValue, { color: metrics.sleep >= 7 ? StatusColors.success : StatusColors.warning }]}>
                    {metrics.sleep}
                  </Text>
                  <Text style={styles.metricItemUnit}>h</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricItemIcon}>✓</Text>
                  <Text style={styles.metricItemLabel}>Adherence</Text>
                  <Text style={[styles.metricItemValue, { color: StatusColors.success }]}>
                    90
                  </Text>
                  <Text style={styles.metricItemUnit}>%</Text>
                </View>
              </View>
            </View>
          </View>
        </Pressable>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Pressable
            style={styles.quickAddButton}
            onPress={() => onNavigate?.("eating")}
          >
            <Text style={styles.quickAddIcon}>+</Text>
            <View style={styles.quickAddContent}>
              <Text style={styles.quickAddTitle}>Quick Check-in</Text>
              <Text style={styles.quickAddDesc}>Update daily metrics in 60s</Text>
            </View>
            <Text style={styles.quickAddArrow}>›</Text>
          </Pressable>
        </View>

        {/* Next Medication */}
        <View style={styles.section}>
          <Pressable onPress={() => onNavigate?.("medications")}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Next Medication</Text>
              <Text style={styles.badge}>{medications.length} Active</Text>
            </View>
          </Pressable>
          {medications.length > 0 && (
            <Pressable onPress={() => onNavigate?.("medications")}>
              <MedicationCard
                emoji={medications[0].emoji}
                name={medications[0].name}
                dosage={medications[0].dosage}
                nextDoseIn={medications[0].nextDoseIn}
                adherencePercent={medications[0].adherencePercent}
                supplyStatus={medications[0].supplyStatus}
                onLog={() => onNavigate?.("medications")}
                onSkip={() => onNavigate?.("medications")}
              />
            </Pressable>
          )}
        </View>

        {/* Health Insights */}
        {/* Health Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Insights</Text>
          <View style={styles.insightsBox}>
            <Pressable style={styles.insightItem} onPress={() => onNavigate?.("log")}>
              <Text style={styles.insightItemIcon}>📈</Text>
              <View style={styles.insightItemContent}>
                <Text style={styles.insightItemTitle}>Energy Trend</Text>
                <Text style={[styles.insightItemValue, { color: StatusColors.success }]}>↑ Improving</Text>
                <Text style={styles.insightItemSubtitle}>Up 2 points this week</Text>
              </View>
            </Pressable>
            <View style={styles.insightDivider} />
            <Pressable style={styles.insightItem} onPress={() => onNavigate?.("eating")}>
              <Text style={styles.insightItemIcon}>💧</Text>
              <View style={styles.insightItemContent}>
                <Text style={styles.insightItemTitle}>Hydration</Text>
                <Text style={[styles.insightItemValue, { color: StatusColors.warning }]}>0L today</Text>
                <Text style={styles.insightItemSubtitle}>You're dehydrated, drink water</Text>
              </View>
            </Pressable>
            <View style={styles.insightDivider} />
            <Pressable style={styles.insightItem} onPress={() => onNavigate?.("log")}>
              <Text style={styles.insightItemIcon}>😴</Text>
              <View style={styles.insightItemContent}>
                <Text style={styles.insightItemTitle}>Sleep Quality</Text>
                <Text style={[styles.insightItemValue, { color: StatusColors.danger }]}>Average</Text>
                <Text style={styles.insightItemSubtitle}>1h less than your baseline</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Trends & Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trends & Progress</Text>
          <Pressable onPress={() => onNavigate?.("insights")}>
            <View style={styles.trendBox}>
              <Text style={styles.trendTitle}>Energy Trend (Last 7 Days)</Text>
              <SimpleLineChart
                data={[5, 6, 6, 7, 6.5, 7, 7]}
                label="Daily Energy Levels"
                color={DataVizColors.energy}
                height={180}
              />
            </View>
          </Pressable>
          <Text style={styles.progressTitle}>This Week</Text>
          <View style={styles.ringRow}>
            <Pressable style={styles.ringItem} onPress={() => onNavigate?.("medications")}>
              <ProgressRing
                percentage={92}
                size={80}
                color={StatusColors.success}
                label="Medications"
              />
            </Pressable>
            <Pressable style={styles.ringItem} onPress={() => onNavigate?.("eating")}>
              <ProgressRing
                percentage={75}
                size={80}
                color={StatusColors.warning}
                label="Hydration"
              />
            </Pressable>
            <Pressable style={styles.ringItem} onPress={() => onNavigate?.("log")}>
              <ProgressRing
                percentage={60}
                size={80}
                color={StatusColors.danger}
                label="Sleep Goal"
              />
            </Pressable>
          </View>
        </View>

        {/* Upcoming Appointment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next Appointment</Text>
          <Pressable onPress={() => onNavigate?.("appointments")}>
            <StatusCard
              icon={<Text style={styles.appointmentIcon}>📅</Text>}
              title="Dr. Jordan LICSW"
              value="in 8 days"
              subtitle="Tuesday, July 29 at 10:00 AM"
              status="info"
            />
          </Pressable>
          <Pressable style={styles.prepButton} onPress={() => onNavigate?.("appointments")}>
            <Text style={styles.prepButtonText}>📝 Add to prep checklist</Text>
          </Pressable>
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Quick Add Bottom Sheet */}
      <QuickAddBottomSheet
        visible={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
        onSubmit={handleQuickAdd}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: UITokens.spacing.lg,
    paddingVertical: UITokens.spacing.lg,
  },
  greeting: {
    fontSize: UITokens.typography.h1.fontSize,
    fontWeight: "700",
    color: colors.text,
  },
  date: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
    marginTop: UITokens.spacing.xs,
  },
  syncButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  syncIcon: {
    fontSize: 20,
    color: colors.red,
  },

  section: {
    paddingHorizontal: UITokens.spacing.lg,
    marginVertical: UITokens.spacing.lg,
  },
  sectionTitle: {
    fontSize: UITokens.typography.h2.fontSize,
    fontWeight: "700",
    color: colors.text,
    marginBottom: UITokens.spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: UITokens.spacing.md,
  },
  badge: {
    backgroundColor: colors.greenLight,
    color: colors.green,
    paddingHorizontal: UITokens.spacing.md,
    paddingVertical: UITokens.spacing.xs,
    borderRadius: UITokens.borderRadius.full,
    fontSize: UITokens.typography.caption.fontSize,
    fontWeight: "600",
  },

  metricsBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: UITokens.spacing.md,
  },
  metricsBoxTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: UITokens.spacing.sm,
  },
  metricsBoxGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: UITokens.spacing.md,
    justifyContent: "space-between",
  },
  metricItem: {
    width: "48%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: UITokens.spacing.md,
  },
  metricItemIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  metricItemLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: "500",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  metricItemValue: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  metricItemUnit: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: "500",
  },

  quickAddButton: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.md,
    alignItems: "center",
    minHeight: UITokens.touchTarget,
    borderWidth: 2,
    borderColor: colors.green,
  },
  quickAddIcon: {
    fontSize: 28,
    color: colors.green,
    marginRight: UITokens.spacing.md,
    fontWeight: "700",
  },
  quickAddContent: {
    flex: 1,
  },
  quickAddTitle: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: colors.text,
  },
  quickAddDesc: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
    marginTop: UITokens.spacing.xs,
  },
  quickAddArrow: {
    fontSize: 20,
    color: colors.textSecondary,
  },

  icon: {
    fontSize: 24,
    marginBottom: UITokens.spacing.sm,
  },

  insightsBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: UITokens.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  insightItem: {
    flexDirection: "row",
    padding: UITokens.spacing.md,
    alignItems: "flex-start",
  },
  insightItemIcon: {
    fontSize: 24,
    marginRight: UITokens.spacing.md,
  },
  insightItemContent: {
    flex: 1,
  },
  insightItemTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 2,
  },
  insightItemValue: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  insightItemSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  insightDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  trendBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: UITokens.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: UITokens.spacing.md,
    marginBottom: UITokens.spacing.md,
  },
  trendTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: UITokens.spacing.sm,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: UITokens.spacing.md,
    marginTop: UITokens.spacing.md,
  },

  ringRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginVertical: UITokens.spacing.sm,
  },
  ringItem: {
    alignItems: "center",
  },

  appointmentIcon: {
    fontSize: 24,
  },

  prepButton: {
    marginTop: UITokens.spacing.md,
    paddingVertical: UITokens.spacing.md,
    paddingHorizontal: UITokens.spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: UITokens.borderRadius.md,
    alignItems: "center",
    minHeight: UITokens.touchTarget,
    justifyContent: "center",
  },
  prepButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  spacer: {
    height: UITokens.spacing.xl,
  },
});

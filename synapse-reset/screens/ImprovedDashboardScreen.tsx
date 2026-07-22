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

const C = {
  dark: {
    primary: "#111827",
    secondary: "#1F2937",
    tertiary: "#374151",
  },
};

export default function ImprovedDashboardScreen() {
  const insets = useSafeAreaInsets();
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
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor={StatusColors.danger}
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

        {/* Key Metrics Row */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Metrics</Text>
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Energy"
              value={metrics.energy}
              unit="/10"
              status={metrics.energy >= 7 ? "good" : "warning"}
              icon={<Text style={styles.icon}>⚡</Text>}
              trend={metrics.energy > 5 ? "up" : "down"}
              trendValue="+1 from yesterday"
            />
            <MetricCard
              label="Mood"
              value={metrics.mood}
              unit="/10"
              status={metrics.mood >= 7 ? "good" : "warning"}
              icon={<Text style={styles.icon}>😊</Text>}
              trend="up"
              trendValue="Stable"
            />
            <MetricCard
              label="Sleep"
              value={metrics.sleep}
              unit="h"
              status={metrics.sleep >= 7 ? "good" : "warning"}
              icon={<Text style={styles.icon}>😴</Text>}
              trend={metrics.sleep > 6 ? "up" : "down"}
              trendValue="-0.5h vs avg"
            />
            <MetricCard
              label="Adherence"
              value={90}
              unit="%"
              status="good"
              icon={<Text style={styles.icon}>✓</Text>}
              trend="up"
              trendValue="This week"
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Pressable
            style={styles.quickAddButton}
            onPress={() => setQuickAddVisible(true)}
          >
            <Text style={styles.quickAddIcon}>+</Text>
            <View style={styles.quickAddContent}>
              <Text style={styles.quickAddTitle}>Quick Check-in</Text>
              <Text style={styles.quickAddDesc}>Update daily metrics in 60s</Text>
            </View>
            <Text style={styles.quickAddArrow}>›</Text>
          </Pressable>
        </View>

        {/* Medications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Medications</Text>
            <Text style={styles.badge}>2 Active</Text>
          </View>
          {medications.map((med, i) => (
            <MedicationCard
              key={i}
              emoji={med.emoji}
              name={med.name}
              dosage={med.dosage}
              nextDoseIn={med.nextDoseIn}
              adherencePercent={med.adherencePercent}
              supplyStatus={med.supplyStatus}
              onLog={() => console.log("Logged:", med.name)}
              onSkip={() => console.log("Skipped:", med.name)}
              style={{ marginBottom: UITokens.spacing.md }}
            />
          ))}
        </View>

        {/* Health Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Insights</Text>
          <StatusCard
            icon={<Text style={styles.insightIcon}>📈</Text>}
            title="Energy Trend"
            value="↑ Improving"
            subtitle="Up 2 points this week"
            status="success"
          />
          <StatusCard
            icon={<Text style={styles.insightIcon}>💧</Text>}
            title="Hydration"
            value="0L today"
            subtitle="You're dehydrated, drink water"
            status="warning"
          />
          <StatusCard
            icon={<Text style={styles.insightIcon}>😴</Text>}
            title="Sleep Quality"
            value="Average"
            subtitle="1h less than your baseline"
            status="danger"
          />
        </View>

        {/* Data Visualization */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Energy Trend (Last 7 Days)</Text>
          <SimpleLineChart
            data={[5, 6, 6, 7, 6.5, 7, 7]}
            label="Daily Energy Levels"
            color={DataVizColors.energy}
            height={200}
          />
        </View>

        {/* Medication Adherence Ring */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week's Progress</Text>
          <View style={styles.ringRow}>
            <View style={styles.ringItem}>
              <ProgressRing
                percentage={92}
                size={100}
                color={StatusColors.success}
                label="Medications"
              />
            </View>
            <View style={styles.ringItem}>
              <ProgressRing
                percentage={75}
                size={100}
                color={StatusColors.warning}
                label="Hydration"
              />
            </View>
            <View style={styles.ringItem}>
              <ProgressRing
                percentage={60}
                size={100}
                color={StatusColors.danger}
                label="Sleep Goal"
              />
            </View>
          </View>
        </View>

        {/* Upcoming Appointment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next Appointment</Text>
          <StatusCard
            icon={<Text style={styles.appointmentIcon}>📅</Text>}
            title="Dr. Jordan LICSW"
            value="in 8 days"
            subtitle="Tuesday, July 29 at 10:00 AM"
            status="info"
          />
          <Pressable style={styles.prepButton}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.dark.primary,
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
    color: "#F3F4F6",
  },
  date: {
    fontSize: UITokens.typography.caption.fontSize,
    color: "#9CA3AF",
    marginTop: UITokens.spacing.xs,
  },
  syncButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.dark.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  syncIcon: {
    fontSize: 20,
    color: StatusColors.danger,
  },

  section: {
    paddingHorizontal: UITokens.spacing.lg,
    marginVertical: UITokens.spacing.lg,
  },
  sectionTitle: {
    fontSize: UITokens.typography.h2.fontSize,
    fontWeight: "700",
    color: "#F3F4F6",
    marginBottom: UITokens.spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: UITokens.spacing.md,
  },
  badge: {
    backgroundColor: StatusColors.success + "20",
    color: StatusColors.success,
    paddingHorizontal: UITokens.spacing.md,
    paddingVertical: UITokens.spacing.xs,
    borderRadius: UITokens.borderRadius.full,
    fontSize: UITokens.typography.caption.fontSize,
    fontWeight: "600",
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: UITokens.spacing.md,
  },
  metricsGrid: {
    gap: UITokens.spacing.md,
  },

  quickAddButton: {
    flexDirection: "row",
    backgroundColor: C.dark.secondary,
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.md,
    alignItems: "center",
    minHeight: UITokens.touchTarget,
    borderWidth: 2,
    borderColor: StatusColors.success,
  },
  quickAddIcon: {
    fontSize: 28,
    color: StatusColors.success,
    marginRight: UITokens.spacing.md,
    fontWeight: "700",
  },
  quickAddContent: {
    flex: 1,
  },
  quickAddTitle: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "#F3F4F6",
  },
  quickAddDesc: {
    fontSize: UITokens.typography.caption.fontSize,
    color: "#9CA3AF",
    marginTop: UITokens.spacing.xs,
  },
  quickAddArrow: {
    fontSize: 20,
    color: "#9CA3AF",
  },

  icon: {
    fontSize: 24,
    marginBottom: UITokens.spacing.sm,
  },

  insightIcon: {
    fontSize: 24,
  },

  ringRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginVertical: UITokens.spacing.lg,
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
    backgroundColor: C.dark.secondary,
    borderRadius: UITokens.borderRadius.md,
    alignItems: "center",
    minHeight: UITokens.touchTarget,
    justifyContent: "center",
  },
  prepButtonText: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "#9CA3AF",
  },

  spacer: {
    height: UITokens.spacing.xl,
  },
});

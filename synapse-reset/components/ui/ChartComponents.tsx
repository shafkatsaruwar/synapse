import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { UITokens, StatusColors, DataVizColors } from "@/constants/ui-design";

interface SimpleLineChartProps {
  data: number[];
  label: string;
  color?: string;
  height?: number;
}

export function SimpleLineChart({
  data,
  label,
  color = DataVizColors.energy,
  height = 200,
}: SimpleLineChartProps) {
  const { colors } = useTheme();
  const dynamicStyles = makeChartStyles(colors);
  if (data.length === 0) return null;

  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;
  const width = Dimensions.get("window").width - 48;
  const barWidth = width / data.length - 4;

  return (
    <View style={dynamicStyles.chartContainer}>
      <Text style={dynamicStyles.chartLabel}>{label}</Text>
      <View style={[dynamicStyles.chart, { height }]}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <View
            key={i}
            style={[
              dynamicStyles.gridLine,
              { top: height * ratio },
            ]}
          />
        ))}

        {/* Bar visualization */}
        <View style={dynamicStyles.barsContainer}>
          {data.map((value, i) => {
            const barHeight = ((value - minValue) / range) * height;
            return (
              <View
                key={i}
                style={[
                  dynamicStyles.chartBar,
                  {
                    width: barWidth,
                    height: Math.max(barHeight, 2),
                    backgroundColor: color,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Legend */}
      <View style={dynamicStyles.chartLegend}>
        <Text style={dynamicStyles.chartMin}>
          Low: {minValue.toFixed(1)}
        </Text>
        <Text style={dynamicStyles.chartMax}>
          High: {maxValue.toFixed(1)}
        </Text>
      </View>
    </View>
  );
}

interface ProgressRingProps {
  percentage: number;
  size?: number;
  color?: string;
  label?: string;
}

export function ProgressRing({
  percentage,
  size = 120,
  color = StatusColors.success,
  label,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const dynamicStyles = makeChartStyles(colors);
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const rotation = (clampedPercentage / 100) * 360;

  return (
    <View style={[dynamicStyles.ringContainer, { width: size, height: size }]}>
      {/* Background circle */}
      <View
        style={[
          dynamicStyles.ringBackground,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 4,
            borderColor: colors.border,
          },
        ]}
      />

      {/* Progress circle - simplified using border */}
      <View
        style={[
          dynamicStyles.ringProgress,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 4,
            borderColor: color,
            borderTopColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: clampedPercentage > 50 ? color : "transparent",
            transform: [{ rotate: `${rotation}deg` }],
          },
        ]}
      />

      {/* Center content */}
      <View style={dynamicStyles.ringContent}>
        <Text style={dynamicStyles.ringPercentage}>
          {Math.round(clampedPercentage)}%
        </Text>
        {label && <Text style={dynamicStyles.ringLabel}>{label}</Text>}
      </View>
    </View>
  );
}

interface HeatmapProps {
  data: { date: string; value: number }[];
  color?: string;
}

export function Heatmap({ data, color = DataVizColors.energy }: HeatmapProps) {
  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <View style={styles.heatmapContainer}>
      <View style={styles.heatmapGrid}>
        {data.map((item, i) => {
          const intensity = item.value / maxValue;
          const opacity = 0.2 + intensity * 0.8;

          return (
            <View
              key={i}
              style={[
                styles.heatmapCell,
                {
                  backgroundColor: color + Math.round(opacity * 255).toString(16),
                },
              ]}
              title={`${item.date}: ${item.value}`}
            />
          );
        })}
      </View>
    </View>
  );
}

interface BarChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}

export function BarChart({
  data,
  color = DataVizColors.adherence,
  height = 200,
}: BarChartProps) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value));
  const barWidth = (Dimensions.get("window").width - 48) / data.length - 8;

  return (
    <View style={[styles.barChart, { height }]}>
      <View style={styles.barContainer}>
        {data.map((item, i) => {
          const barHeight = (item.value / maxValue) * height;
          return (
            <View key={i} style={styles.barWrapper}>
              <View
                style={[
                  styles.bar,
                  {
                    width: barWidth,
                    height: barHeight,
                    backgroundColor: color,
                  },
                ]}
              />
              <Text style={styles.barLabel}>{item.label}</Text>
              <Text style={styles.barValue}>{item.value}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeChartStyles = (colors: any) => StyleSheet.create({
  chartContainer: {
    marginVertical: UITokens.spacing.lg,
  },
  chartLabel: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: colors.text,
    marginBottom: UITokens.spacing.md,
  },
  chart: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.md,
    position: "relative",
    overflow: "hidden",
  },
  gridLine: {
    position: "absolute",
    width: "100%",
    height: 1,
    backgroundColor: colors.border,
  },
  barsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 4,
    height: "100%",
    paddingVertical: UITokens.spacing.md,
  },
  chartBar: {
    borderRadius: 2,
  },
  dataPoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: UITokens.spacing.md,
    paddingHorizontal: UITokens.spacing.md,
  },
  chartMin: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
  },
  chartMax: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
  },

  ringContainer: {
    justifyContent: "center",
    alignItems: "center",
    margin: UITokens.spacing.lg,
  },
  ringBackground: {
    position: "absolute",
  },
  ringProgress: {
    position: "absolute",
  },
  ringContent: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  ringPercentage: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  ringLabel: {
    fontSize: UITokens.typography.caption.fontSize,
    color: colors.textSecondary,
    marginTop: UITokens.spacing.xs,
  },
});

const styles = StyleSheet.create({
  heatmapContainer: {
    marginVertical: UITokens.spacing.lg,
  },
  heatmapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: UITokens.spacing.xs,
    backgroundColor: "#1F2937",
    padding: UITokens.spacing.md,
    borderRadius: UITokens.borderRadius.md,
  },
  heatmapCell: {
    width: "14%",
    aspectRatio: 1,
    borderRadius: UITokens.borderRadius.sm,
    borderWidth: 1,
    borderColor: "#374151",
  },

  barChart: {
    backgroundColor: "#1F2937",
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.lg,
    marginVertical: UITokens.spacing.lg,
  },
  barContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: "100%",
  },
  barWrapper: {
    alignItems: "center",
    flex: 1,
  },
  bar: {
    borderRadius: UITokens.borderRadius.sm,
    marginBottom: UITokens.spacing.md,
  },
  barLabel: {
    fontSize: UITokens.typography.caption.fontSize,
    color: "#9CA3AF",
    marginBottom: UITokens.spacing.xs,
  },
  barValue: {
    fontSize: UITokens.typography.caption.fontSize,
    fontWeight: "600",
    color: "#F3F4F6",
  },
});

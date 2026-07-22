import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
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
  if (data.length === 0) return null;

  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;
  const width = Dimensions.get("window").width - 48; // Account for padding
  const pointSpacing = width / (data.length - 1 || 1);

  const points = data.map((value, i) => {
    const y = height - ((value - minValue) / range) * height;
    const x = i * pointSpacing;
    return { x, y, value };
  });

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartLabel}>{label}</Text>
      <View style={[styles.chart, { height }]}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <View
            key={i}
            style={[
              styles.gridLine,
              { top: height * ratio },
            ]}
          />
        ))}

        {/* Line path visualization */}
        <svg
          style={StyleSheet.absoluteFill}
          width={width}
          height={height}
        >
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3"
              fill={color}
            />
          ))}
        </svg>

        {/* Data points */}
        {points.map((p, i) => (
          <View
            key={i}
            style={[
              styles.dataPoint,
              {
                left: p.x - 4,
                top: p.y - 4,
                backgroundColor: color,
              },
            ]}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.chartLegend}>
        <Text style={styles.chartMin}>
          Low: {minValue.toFixed(1)}
        </Text>
        <Text style={styles.chartMax}>
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
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={[styles.ringContainer, { width: size, height: size }]}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={StyleSheet.absoluteFill}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#374151"
          strokeWidth="4"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <View style={styles.ringContent}>
        <Text style={styles.ringPercentage}>
          {Math.round(percentage)}%
        </Text>
        {label && <Text style={styles.ringLabel}>{label}</Text>}
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

const styles = StyleSheet.create({
  chartContainer: {
    marginVertical: UITokens.spacing.lg,
  },
  chartLabel: {
    fontSize: UITokens.typography.body.fontSize,
    fontWeight: "600",
    color: "#F3F4F6",
    marginBottom: UITokens.spacing.md,
  },
  chart: {
    backgroundColor: "#1F2937",
    borderRadius: UITokens.borderRadius.md,
    padding: UITokens.spacing.md,
    position: "relative",
  },
  gridLine: {
    position: "absolute",
    width: "100%",
    height: 1,
    backgroundColor: "#374151",
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
    color: "#9CA3AF",
  },
  chartMax: {
    fontSize: UITokens.typography.caption.fontSize,
    color: "#9CA3AF",
  },

  ringContainer: {
    justifyContent: "center",
    alignItems: "center",
    margin: UITokens.spacing.lg,
  },
  ringContent: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  ringPercentage: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F3F4F6",
  },
  ringLabel: {
    fontSize: UITokens.typography.caption.fontSize,
    color: "#9CA3AF",
    marginTop: UITokens.spacing.xs,
  },

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

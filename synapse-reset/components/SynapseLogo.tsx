import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

interface SynapseLogoProps {
  size?: number;
  color?: string;
}

export default function SynapseLogo({ size = 40, color = "#800020" }: SynapseLogoProps) {
  const strokeWidth = size * 0.06;
  const circleRadius = size * 0.12;
  const viewBox = `0 0 ${size} ${size}`;
  const cx1 = size * 0.28;
  const cx2 = size * 0.72;
  const cy = size * 0.5;
  const gap = size * 0.04;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox={viewBox}>
        <Circle cx={cx1} cy={cy} r={circleRadius} fill="none" stroke={color} strokeWidth={strokeWidth} />
        <Circle cx={cx2} cy={cy} r={circleRadius} fill="none" stroke={color} strokeWidth={strokeWidth} />
        <Path
          d={`M ${cx1 + circleRadius + gap} ${cy} Q ${size * 0.5} ${cy - size * 0.18} ${cx2 - circleRadius - gap} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <Path
          d={`M ${cx1 + circleRadius + gap} ${cy} Q ${size * 0.5} ${cy + size * 0.18} ${cx2 - circleRadius - gap} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${size * 0.04} ${size * 0.06}`}
        />
      </Svg>
    </View>
  );
}

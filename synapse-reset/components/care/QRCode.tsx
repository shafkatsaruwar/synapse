import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import qrcode from "qrcode-generator";

/** Renders text as a QR code locally. Nothing is fetched or sent anywhere. */
export default function QRCode({ value, size = 240 }: { value: string; size?: number }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, "L");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const rects: { x: number; y: number }[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) rects.push({ x: c, y: r });
    return { n, rects };
  }, [value]);
  const quiet = 4;
  const total = cells.n + quiet * 2;
  return (
    <View style={{ width: size, height: size, backgroundColor: "#fff", borderRadius: 12, overflow: "hidden" }} accessible accessibilityLabel="QR code invitation">
      <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
        {cells.rects.map((r) => (
          <Rect key={`${r.x}-${r.y}`} x={r.x + quiet} y={r.y + quiet} width={1.02} height={1.02} fill="#000" />
        ))}
      </Svg>
    </View>
  );
}

import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F6F3EE",
          color: "#161311",
          padding: "72px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 4, color: "#A30D24" }}>SYNAPSE</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 68, lineHeight: 1.05, maxWidth: 860 }}>Your health life, finally in one place.</div>
          <div style={{ fontSize: 28, color: "#5E5852" }}>A personal health companion for iPhone.</div>
        </div>
      </div>
    ),
    { ...size },
  );
}

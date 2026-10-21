import type { PanelId } from "@/lib/animation/scene-sample";

export const panelFaces: Record<
  PanelId,
  { foreign: string; foreignDetail: string; synapse: string; synapseDetail: string; mark: string; tint: string }
> = {
  feeling: {
    foreign: "Daynote",
    foreignDetail: "Today · steady",
    synapse: "How I’m Feeling",
    synapseDetail: "A day, in your words",
    mark: "D",
    tint: "#C9A39C",
  },
  medications: {
    foreign: "Dosebook",
    foreignDetail: "Morning · 1 tablet",
    synapse: "Medications",
    synapseDetail: "Schedules and doses",
    mark: "M",
    tint: "#C4A08A",
  },
  appointments: {
    foreign: "Visitly",
    foreignDetail: "Thursday · 2:30 PM",
    synapse: "Appointments",
    synapseDetail: "What is next",
    mark: "V",
    tint: "#8EA592",
  },
  emergency: {
    foreign: "Cardkeep",
    foreignDetail: "Important details",
    synapse: "Emergency",
    synapseDetail: "A card you control",
    mark: "C",
    tint: "#C49AA3",
  },
  records: {
    foreign: "Recorda",
    foreignDetail: "Labs you keep",
    synapse: "Health Records",
    synapseDetail: "Within reach",
    mark: "R",
    tint: "#9AA3AE",
  },
};

/** Logical panel face. Textures are this size times `panelTextureScale`. */
export const PANEL_FACE_WIDTH = 1024;
export const PANEL_FACE_HEIGHT = 640;

/**
 * Desktop textures stay at least 2× so a 1× framebuffer does not enlarge a soft
 * face, and cap at 3× so a 4K display does not allocate a fourth copy.
 * Mobile stays within 1–1.5×.
 */
export function panelTextureScale(dpr: number, mobile: boolean) {
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  if (mobile) return Math.min(1.5, Math.max(1, ratio));
  return Math.min(3, Math.max(2, ratio));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawPanelFace(canvas: HTMLCanvasElement, id: PanelId, synapse: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const face = panelFaces[id];
  const scale = canvas.width / PANEL_FACE_WIDTH;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const w = PANEL_FACE_WIDTH;
  const h = PANEL_FACE_HEIGHT;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = synapse ? "rgba(255,250,247,0.78)" : "rgba(255,255,255,0.42)";
  roundRect(ctx, 24, 24, w - 48, h - 48, 36);
  ctx.fill();
  ctx.strokeStyle = synapse ? "rgba(163,13,36,0.45)" : "rgba(255,255,255,0.8)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = synapse ? "#A30D24" : face.tint;
  ctx.beginPath();
  ctx.arc(110, 150, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = synapse ? "#FBF7F4" : "#1C1614";
  ctx.font = "600 36px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(face.mark, 110, 152);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = synapse ? "#A30D24" : "#3A342F";
  ctx.font = "500 28px Georgia, serif";
  ctx.fillText(synapse ? "SYNAPSE" : face.foreign.toUpperCase(), 170, 140);

  ctx.fillStyle = "#161311";
  ctx.font = "560 72px Georgia, serif";
  const title = synapse ? face.synapse : face.foreign;
  ctx.fillText(title, 78, 280);

  ctx.fillStyle = "#5E5852";
  ctx.font = "400 36px Georgia, serif";
  ctx.fillText(synapse ? face.synapseDetail : face.foreignDetail, 80, 360);

  ctx.strokeStyle = synapse ? "rgba(163,13,36,0.35)" : "rgba(40,30,24,0.18)";
  ctx.beginPath();
  ctx.moveTo(80, 420);
  ctx.lineTo(w - 80, 420);
  ctx.stroke();
}

export function drawTodayScreen(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#F6F3EE";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#A30D24";
  ctx.font = "600 28px Georgia, serif";
  ctx.fillText("SYNAPSE", 56, 120);
  ctx.fillStyle = "#161311";
  ctx.font = "560 84px Georgia, serif";
  ctx.fillText("Today", 52, 220);
  ctx.fillStyle = "#5E5852";
  ctx.font = "400 32px Georgia, serif";
  wrapText(ctx, "A quiet moment for your health.", 56, 280, w - 112, 42);

  let y = 390;
  y = card(ctx, 40, y, w - 80, "Medications today", [
    ["Lisinopril 10 mg", "Morning · Taken"],
    ["Vitamin D 1000 IU", "Morning · Taken"],
    ["Cetirizine 10 mg", "Evening · Due"],
  ]);
  y += 28;
  y = card(ctx, 40, y, w - 80, "Upcoming", [["Dr. Elena Cho", "Thursday · 2:30 PM"], ["Harbor Clinic", "Sample visit"]]);
  y += 28;
  card(ctx, 40, y, w - 80, "How you’re feeling", [
    ["Overall", "Okay"],
    ["Energy", "Good"],
    ["Sleep", "High"],
  ]);

  ctx.fillStyle = "#8A837C";
  ctx.font = "400 24px Georgia, serif";
  ctx.fillText("Sample information. Not a real record.", 56, h - 64);
}

function card(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, title: string, rows: [string, string][]) {
  const height = 92 + rows.length * 72;
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  roundRect(ctx, x, y, width, height, 28);
  ctx.fill();
  ctx.strokeStyle = "rgba(28,21,18,0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#A30D24";
  ctx.font = "600 26px Georgia, serif";
  ctx.fillText(title.toUpperCase(), x + 32, y + 52);
  rows.forEach((row, index) => {
    const ry = y + 108 + index * 72;
    ctx.fillStyle = "#161311";
    ctx.font = "500 32px Georgia, serif";
    ctx.fillText(row[0], x + 32, ry);
    ctx.fillStyle = "#5E5852";
    ctx.font = "400 26px Georgia, serif";
    ctx.textAlign = "right";
    ctx.fillText(row[1], x + width - 32, ry);
    ctx.textAlign = "left";
  });
  return y + height;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line: number) {
  const words = text.split(" ");
  let row = "";
  let yy = y;
  for (const word of words) {
    const test = row ? `${row} ${word}` : word;
    if (ctx.measureText(test).width > max) {
      ctx.fillText(row, x, yy);
      row = word;
      yy += line;
    } else {
      row = test;
    }
  }
  ctx.fillText(row, x, yy);
}

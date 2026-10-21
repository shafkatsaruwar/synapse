/**
 * Deterministic scroll choreography for the Synapse studio sequence.
 * Pure math: no Three.js, no randomness. The same progress always yields the same pose.
 * Named phases: INTRO, SCATTERED, DISCONNECTION, RELEASE, FALL, STACK, ALIGN, MERGE, REVEAL.
 */

export const PHASES = [
  { name: "INTRO", start: 0, end: 0.1 },
  { name: "SCATTERED", start: 0.1, end: 0.28 },
  { name: "DISCONNECTION", start: 0.28, end: 0.36 },
  { name: "RELEASE", start: 0.36, end: 0.44 },
  { name: "FALL", start: 0.44, end: 0.6 },
  { name: "STACK", start: 0.6, end: 0.72 },
  { name: "ALIGN", start: 0.72, end: 0.82 },
  { name: "MERGE", start: 0.82, end: 0.91 },
  { name: "REVEAL", start: 0.91, end: 1 },
] as const;

export type PhaseName = (typeof PHASES)[number]["name"];

export type Vec3 = { x: number; y: number; z: number };

export type PanelId = "feeling" | "medications" | "appointments" | "emergency" | "records";

export type PanelPose = {
  id: PanelId;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  opacity: number;
  synapseMix: number;
  stringDetach: number;
  width: number;
  height: number;
  thickness: number;
};

export type SceneSample = {
  phase: PhaseName;
  camera: { position: Vec3; lookAt: Vec3; fov: number };
  panels: PanelPose[];
  screenReveal: number;
  sway: number;
};

export type HeroCopy = {
  kicker: string;
  title: string;
  body: string;
  showIntroCta: boolean;
  showRevealCta: boolean;
};

type Pose = { position: Vec3; rotation: Vec3 };

type PanelDef = {
  id: PanelId;
  width: number;
  height: number;
  thickness: number;
  hang: Pose;
  tumble: number;
  tumbleZ: number;
};

const STACK_X = [-0.1, 0.13, -0.07, 0.11, -0.15];
const STACK_Z = [0.08, -0.1, 0.12, -0.04, 0.07];
const STACK_YAW = [0.055, -0.07, 0.05, -0.045, 0.085];
const STACK_TILT = [0.016, -0.012, 0.018, -0.014, 0.01];
const STACK_ROLL = [-0.02, 0.014, -0.01, 0.018, -0.012];

/** Fall order is array order: front-lowest first. */
export const PANEL_DEFS: PanelDef[] = [
  {
    id: "feeling",
    width: 1.02,
    height: 0.84,
    thickness: 0.02,
    hang: {
      position: { x: -0.2, y: 1.82, z: 1.28 },
      rotation: { x: -0.07, y: 0.14, z: 0.05 },
    },
    tumble: 0.22,
    tumbleZ: 0.18,
  },
  {
    id: "medications",
    width: 1.22,
    height: 0.76,
    thickness: 0.02,
    hang: {
      position: { x: -1.82, y: 2.48, z: 0.12 },
      rotation: { x: 0.05, y: -0.26, z: 0.04 },
    },
    tumble: -0.28,
    tumbleZ: 0.12,
  },
  {
    id: "appointments",
    width: 1.14,
    height: 0.8,
    thickness: 0.02,
    hang: {
      position: { x: 1.78, y: 2.22, z: 0.22 },
      rotation: { x: -0.04, y: 0.3, z: -0.05 },
    },
    tumble: 0.2,
    tumbleZ: -0.16,
  },
  {
    id: "emergency",
    width: 1.06,
    height: 0.68,
    thickness: 0.02,
    hang: {
      position: { x: 1.22, y: 3.28, z: -1.12 },
      rotation: { x: 0.06, y: 0.2, z: -0.03 },
    },
    tumble: -0.16,
    tumbleZ: 0.1,
  },
  {
    id: "records",
    width: 1.28,
    height: 0.72,
    thickness: 0.02,
    hang: {
      position: { x: -1.12, y: 3.48, z: -0.98 },
      rotation: { x: 0.09, y: -0.14, z: 0.03 },
    },
    tumble: 0.14,
    tumbleZ: -0.08,
  },
];

const PHONE = {
  width: 0.74,
  thickness: 0.078,
  depth: 1.56,
};

type CamKey = { t: number; position: Vec3; lookAt: Vec3; fov: number };

const DESKTOP_CAM: CamKey[] = [
  { t: 0, position: { x: 0.15, y: 2.08, z: 6.7 }, lookAt: { x: 0, y: 1.45, z: 0.1 }, fov: 30 },
  { t: 0.1, position: { x: 0.05, y: 2.1, z: 6.45 }, lookAt: { x: 0, y: 1.5, z: 0.05 }, fov: 30 },
  { t: 0.16, position: { x: -0.95, y: 2.28, z: 5.35 }, lookAt: { x: -1.82, y: 2.48, z: 0.12 }, fov: 28 },
  { t: 0.22, position: { x: 0.95, y: 2.2, z: 5.25 }, lookAt: { x: 1.78, y: 2.22, z: 0.22 }, fov: 28 },
  { t: 0.28, position: { x: 0.1, y: 2.0, z: 4.7 }, lookAt: { x: -0.2, y: 1.82, z: 1.28 }, fov: 30 },
  { t: 0.36, position: { x: 0.35, y: 2.45, z: 7.2 }, lookAt: { x: 0, y: 1.55, z: 0 }, fov: 32 },
  { t: 0.44, position: { x: 0.28, y: 2.2, z: 6.6 }, lookAt: { x: 0, y: 1.3, z: 0 }, fov: 32 },
  { t: 0.54, position: { x: 0.55, y: 1.7, z: 5.2 }, lookAt: { x: 0, y: 0.8, z: 0 }, fov: 32 },
  { t: 0.66, position: { x: 0.95, y: 1.32, z: 3.55 }, lookAt: { x: 0.02, y: 0.38, z: 0 }, fov: 30 },
  { t: 0.78, position: { x: 0.4, y: 1.5, z: 3.6 }, lookAt: { x: 0, y: 0.4, z: 0 }, fov: 30 },
  { t: 0.88, position: { x: 0.08, y: 1.85, z: 2.95 }, lookAt: { x: 0, y: 0.18, z: 0 }, fov: 28 },
  { t: 1, position: { x: 0, y: 2.15, z: 2.28 }, lookAt: { x: 0, y: 0.02, z: 0 }, fov: 26 },
];

const MOBILE_CAM: CamKey[] = [
  { t: 0, position: { x: 0.04, y: 2.7, z: 7.6 }, lookAt: { x: 0, y: 1.85, z: 0.05 }, fov: 40 },
  { t: 0.1, position: { x: 0, y: 2.75, z: 7.35 }, lookAt: { x: 0, y: 1.9, z: 0 }, fov: 40 },
  { t: 0.17, position: { x: -0.7, y: 2.85, z: 6.4 }, lookAt: { x: -1.5, y: 2.4, z: 0.15 }, fov: 40 },
  { t: 0.24, position: { x: 0.75, y: 2.6, z: 6.2 }, lookAt: { x: 1.5, y: 2.15, z: 0.2 }, fov: 40 },
  { t: 0.3, position: { x: 0.05, y: 2.4, z: 5.8 }, lookAt: { x: 0, y: 1.8, z: 0.7 }, fov: 42 },
  { t: 0.4, position: { x: 0.15, y: 2.95, z: 7.8 }, lookAt: { x: 0, y: 1.65, z: 0 }, fov: 42 },
  { t: 0.54, position: { x: 0.3, y: 2.15, z: 6.3 }, lookAt: { x: 0, y: 0.85, z: 0 }, fov: 42 },
  { t: 0.66, position: { x: 0.45, y: 1.9, z: 4.7 }, lookAt: { x: 0, y: 0.42, z: 0 }, fov: 40 },
  { t: 0.82, position: { x: 0.12, y: 2.05, z: 4.15 }, lookAt: { x: 0, y: 0.35, z: 0 }, fov: 40 },
  { t: 1, position: { x: 0, y: 2.45, z: 2.9 }, lookAt: { x: 0, y: 0.04, z: 0 }, fov: 36 },
];

export function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function smootherstep(t: number) {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    position: lerpVec(a.position, b.position, t),
    rotation: {
      x: lerpAngle(a.rotation.x, b.rotation.x, t),
      y: lerpAngle(a.rotation.y, b.rotation.y, t),
      z: lerpAngle(a.rotation.z, b.rotation.z, t),
    },
  };
}

export function phaseAt(progress: number): PhaseName {
  const p = clamp01(progress);
  let current: PhaseName = PHASES[0].name;
  for (const phase of PHASES) {
    if (p >= phase.start) current = phase.name;
  }
  return current;
}

export function phaseMidpoint(name: PhaseName) {
  const phase = PHASES.find((item) => item.name === name);
  if (!phase) return 0;
  return (phase.start + phase.end) / 2;
}

function stackPose(index: number): Pose {
  return {
    position: {
      x: STACK_X[index],
      y: 0.2 + index * 0.06,
      z: STACK_Z[index],
    },
    rotation: {
      x: -Math.PI / 2 + STACK_TILT[index],
      y: STACK_YAW[index],
      z: STACK_ROLL[index],
    },
  };
}

function alignPose(index: number, count: number): Pose {
  const centered = (index - (count - 1) / 2) * 0.046;
  return {
    position: { x: 0, y: 0.22 + centered + (count - 1) * 0.02, z: 0 },
    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
  };
}

function mergePose(): Pose {
  return {
    position: { x: 0, y: 0.086, z: 0 },
    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
  };
}

function fallWindow(index: number) {
  const start = 0.448 + index * 0.018;
  const duration = 0.068 + (index % 2) * 0.014;
  return { start, end: start + duration };
}

function detachAmount(progress: number, index: number) {
  const start = 0.362 + index * 0.01;
  const end = start + 0.028;
  return smoothstep(start, end, progress);
}

/** Drop in place, then settle sideways into the staggered stack so paths do not cross. */
function fallingPose(def: PanelDef, index: number, fallT: number): Pose {
  const hang = def.hang;
  const stack = stackPose(index);
  const hoverY = stack.position.y + 0.48;
  const dropT = smoothstep(0, 1, Math.min(1, fallT / 0.68));
  const settleT = smoothstep(0, 1, Math.max(0, (fallT - 0.68) / 0.32));
  const y = fallT < 0.68 ? lerp(hang.position.y, hoverY, dropT) : lerp(hoverY, stack.position.y, settleT);
  const bump = Math.sin(clamp01(fallT) * Math.PI);
  const rotT = smoothstep(0, 1, fallT);
  return {
    position: {
      x: lerp(hang.position.x, stack.position.x, settleT),
      y,
      z: lerp(hang.position.z, stack.position.z, settleT),
    },
    rotation: {
      x: lerpAngle(hang.rotation.x, stack.rotation.x, rotT) + bump * def.tumble,
      y: lerpAngle(hang.rotation.y, stack.rotation.y, rotT) + bump * def.tumble * 0.35,
      z: lerpAngle(hang.rotation.z, stack.rotation.z, rotT) + bump * def.tumbleZ,
    },
  };
}

function poseForPanel(def: PanelDef, index: number, count: number, progress: number): { pose: Pose; scale: Vec3; opacity: number; synapseMix: number } {
  const hang = def.hang;
  const stack = stackPose(index);
  const aligned = alignPose(index, count);
  const merged = mergePose();
  const { start, end } = fallWindow(index);
  const fallT = smoothstep(start, end, progress);

  let pose = hang;
  let scale: Vec3 = { x: 1, y: 1, z: 1 };
  let opacity = 1;
  let synapseMix = 0;

  if (progress < start) {
    pose = hang;
  } else if (progress < 0.72) {
    pose = fallingPose(def, index, fallT);
  } else if (progress < 0.82) {
    const t = smootherstep((progress - 0.72) / 0.1);
    pose = lerpPose(stack, aligned, t);
    const uniform = lerp(1, 0.92, t);
    scale = {
      x: uniform * lerp(1, 1.05 / def.width, t),
      y: uniform * lerp(1, 0.7 / def.height, t),
      z: 1,
    };
    synapseMix = t;
  } else {
    const t = smootherstep((progress - 0.82) / 0.09);
    const alignedScale: Vec3 = {
      x: 0.92 * (1.05 / def.width),
      y: 0.92 * (0.7 / def.height),
      z: 1,
    };
    const mergeScale: Vec3 = {
      x: 0.64 / def.width,
      y: 1.32 / def.height,
      z: 1,
    };
    pose = lerpPose(aligned, merged, t);
    scale = {
      x: lerp(alignedScale.x, mergeScale.x, t),
      y: lerp(alignedScale.y, mergeScale.y, t),
      z: 1,
    };
    synapseMix = 1;
    opacity = 1 - smoothstep(0.2, 1, t);
  }

  if (progress >= 0.91) opacity = 0;
  return { pose, scale, opacity, synapseMix };
}

function sampleCamera(progress: number, time: number, mobile: boolean) {
  const keys = mobile ? MOBILE_CAM : DESKTOP_CAM;
  let i = 0;
  while (i < keys.length - 2 && progress > keys[i + 1].t) i += 1;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const span = Math.max(0.0001, b.t - a.t);
  const t = smoothstep(0, 1, (progress - a.t) / span);
  const position = lerpVec(a.position, b.position, t);
  const lookAt = lerpVec(a.lookAt, b.lookAt, t);
  const fov = lerp(a.fov, b.fov, t);

  const orbit = smoothstep(0.615, 0.645, progress) * (1 - smoothstep(0.69, 0.72, progress));
  position.x += Math.sin(time * 0.35) * 0.14 * orbit;
  position.z += (Math.cos(time * 0.35) - 1) * 0.05 * orbit;

  return { position, lookAt, fov };
}

export type SampleOptions = {
  mobile?: boolean;
  count?: number;
  /** Seconds. Sway and the stack orbit use time; pass 0 to freeze them. */
  time?: number;
};

export function sampleScene(progress: number, options: SampleOptions = {}): SceneSample {
  const p = clamp01(progress);
  const time = options.time ?? 0;
  const count = Math.min(PANEL_DEFS.length, Math.max(1, options.count ?? PANEL_DEFS.length));
  const sway = 1 - smoothstep(0.28, 0.345, p);
  const panels: PanelPose[] = PANEL_DEFS.slice(0, count).map((def, index) => {
    const posed = poseForPanel(def, index, count, p);
    const rotation = {
      x: posed.pose.rotation.x + Math.cos(time * 0.55 + index * 0.9) * 0.012 * sway,
      y: posed.pose.rotation.y,
      z: posed.pose.rotation.z + Math.sin(time * 0.7 + index * 1.2) * 0.02 * sway,
    };
    return {
      id: def.id,
      position: posed.pose.position,
      rotation,
      scale: posed.scale,
      opacity: posed.opacity,
      synapseMix: posed.synapseMix,
      stringDetach: detachAmount(p, index),
      width: def.width,
      height: def.height,
      thickness: def.thickness,
    };
  });

  const screenReveal = smoothstep(0.825, 0.9, p);

  return {
    phase: phaseAt(p),
    camera: sampleCamera(p, time, Boolean(options.mobile)),
    panels,
    screenReveal,
    sway,
  };
}

/** Rotate a local point by XYZ Euler, matching Three.js default order. */
export function rotateXYZ(v: Vec3, r: Vec3): Vec3 {
  const cx = Math.cos(r.x);
  const sx = Math.sin(r.x);
  let y = v.y * cx - v.z * sx;
  let z = v.y * sx + v.z * cx;
  const cy = Math.cos(r.y);
  const sy = Math.sin(r.y);
  const x1 = v.x * cy + z * sy;
  z = -v.x * sy + z * cy;
  const cz = Math.cos(r.z);
  const sz = Math.sin(r.z);
  const x = x1 * cz - y * sz;
  y = x1 * sz + y * cz;
  return { x, y, z };
}

export function panelCorners(panel: PanelPose): Vec3[] {
  const hx = (panel.width * panel.scale.x) / 2;
  const hy = (panel.height * panel.scale.y) / 2;
  const hz = (panel.thickness * panel.scale.z) / 2;
  const corners: Vec3[] = [];
  for (const x of [-hx, hx]) {
    for (const y of [-hy, hy]) {
      for (const z of [-hz, hz]) {
        const rotated = rotateXYZ({ x, y, z }, panel.rotation);
        corners.push({
          x: rotated.x + panel.position.x,
          y: rotated.y + panel.position.y,
          z: rotated.z + panel.position.z,
        });
      }
    }
  }
  return corners;
}

export function aabbOf(points: Vec3[]) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z);
  }
  return { min, max };
}

function aabbOverlap(a: { min: Vec3; max: Vec3 }, b: { min: Vec3; max: Vec3 }, gap: number) {
  return (
    a.min.x < b.max.x - gap &&
    a.max.x > b.min.x + gap &&
    a.min.y < b.max.y - gap &&
    a.max.y > b.min.y + gap &&
    a.min.z < b.max.z - gap &&
    a.max.z > b.min.z + gap
  );
}

export function phoneAabb() {
  return {
    min: { x: -PHONE.width / 2, y: 0, z: -PHONE.depth / 2 },
    max: { x: PHONE.width / 2, y: PHONE.thickness, z: PHONE.depth / 2 },
  };
}

/** True when two solid boxes occupy the same volume, ignoring a small gap. */
export function panelsIntersect(a: PanelPose, b: PanelPose, gap = 0.004) {
  if (a.opacity < 0.15 || b.opacity < 0.15) return false;
  return aabbOverlap(aabbOf(panelCorners(a)), aabbOf(panelCorners(b)), gap);
}

export function panelHitsPhone(panel: PanelPose) {
  if (panel.opacity < 0.15) return false;
  return aabbOverlap(aabbOf(panelCorners(panel)), phoneAabb(), 0.002);
}

export const SCATTERED_LINES = ["Different apps.", "Different platforms.", "Different places to look."] as const;

export function heroCopy(progress: number): HeroCopy {
  const phase = phaseAt(progress);
  if (phase === "INTRO") {
    return {
      kicker: "",
      title: "Your health. Everywhere.",
      body: "Medications. Appointments. Records. Important details. All in different places.",
      showIntroCta: true,
      showRevealCta: false,
    };
  }
  if (phase === "SCATTERED") {
    const local = clamp01((progress - 0.1) / 0.18);
    const index = Math.min(SCATTERED_LINES.length - 1, Math.floor(local * SCATTERED_LINES.length));
    return {
      kicker: "",
      title: SCATTERED_LINES[index],
      body: "",
      showIntroCta: false,
      showRevealCta: false,
    };
  }
  if (phase === "DISCONNECTION" || phase === "RELEASE") {
    return { kicker: "", title: "No more.", body: "", showIntroCta: false, showRevealCta: false };
  }
  if (phase === "REVEAL") {
    const local = clamp01((progress - 0.91) / 0.09);
    if (local < 0.4) {
      return {
        kicker: "Meet Synapse.",
        title: "Your personal health companion.",
        body: "",
        showIntroCta: false,
        showRevealCta: true,
      };
    }
    return {
      kicker: "Meet Synapse.",
      title: "Your health life, finally in one place.",
      body: "Your personal health companion.",
      showIntroCta: false,
      showRevealCta: true,
    };
  }
  return { kicker: "", title: "", body: "", showIntroCta: false, showRevealCta: false };
}

export const PHONE_SIZE = PHONE;
export const STRING_ANCHOR_Y = 8.4;

"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
  SRGBColorSpace,
} from "three";
import { panelGroups, sceneBridge } from "@/lib/animation/bridge";
import { PANEL_FACE_HEIGHT, PANEL_FACE_WIDTH, drawPanelFace, panelFaces, panelTextureScale } from "@/lib/screens/draw";
import { PANEL_DEFS, type PanelId } from "@/lib/animation/scene-sample";

const burgundy = new Color("#f4e6e8");
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789’'·.,";

const fillCache = new Map<string, CanvasTexture>();

/** The frosted fill does not vary by panel, so all five sheets share two maps. */
function sharedFill(synapse: boolean, scale: number) {
  const key = `${synapse ? "synapse" : "foreign"}:${scale}`;
  const cached = fillCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PANEL_FACE_WIDTH * scale);
  canvas.height = Math.round(PANEL_FACE_HEIGHT * scale);
  drawPanelFace(canvas, "feeling", synapse);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 16;
  map.generateMipmaps = true;
  map.minFilter = LinearMipmapLinearFilter;
  map.magFilter = LinearFilter;
  map.needsUpdate = true;
  fillCache.set(key, map);
  return map;
}

/** Rounded in the face plane, thin in Z. A uniform rounded box would turn the sheet into a capsule. */
function roundedFace(width: number, height: number, depth: number, radius: number, curve: number) {
  const shape = new Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2 - 0.001, height / 2 - 0.001);
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.absarc(x + width - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + width, y + height - r);
  shape.absarc(x + width - r, y + height - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + height);
  shape.absarc(x + r, y + height - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.0015,
    bevelSegments: 1,
    curveSegments: curve,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function FaceCopy({
  id,
  synapse,
  width,
  height,
}: {
  id: PanelId;
  synapse: boolean;
  width: number;
  height: number;
}) {
  const face = panelFaces[id];
  const title = synapse ? face.synapse : face.foreign;
  const detail = synapse ? face.synapseDetail : face.foreignDetail;
  const kicker = synapse ? "SYNAPSE" : face.foreign.toUpperCase();
  const sdf = sceneBridge.mobile ? 96 : 128;
  const xOf = (px: number) => (px / PANEL_FACE_WIDTH - 0.5) * width;
  const yOf = (py: number) => (0.5 - py / PANEL_FACE_HEIGHT) * height;
  const sizeOf = (px: number) => (px / PANEL_FACE_HEIGHT) * height;
  const markX = xOf(110);
  const markY = yOf(150);
  return (
    <group>
      <mesh position={[markX, markY, 0.018]}>
        <circleGeometry args={[sizeOf(36), sceneBridge.mobile ? 24 : 32]} />
        <meshBasicMaterial color={synapse ? "#A30D24" : face.tint} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <Text
        position={[markX, markY, 0.02]}
        fontSize={sizeOf(36)}
        color={synapse ? "#FBF7F4" : "#1C1614"}
        anchorX="center"
        anchorY="middle"
        sdfGlyphSize={sdf}
        characters={GLYPHS}
      >
        {face.mark}
      </Text>
      <Text
        position={[xOf(170), yOf(140), 0.02]}
        fontSize={sizeOf(28)}
        color={synapse ? "#A30D24" : "#3A342F"}
        anchorX="left"
        anchorY="bottom-baseline"
        sdfGlyphSize={sdf}
        characters={GLYPHS}
      >
        {kicker}
      </Text>
      <Text
        position={[xOf(78), yOf(280), 0.02]}
        fontSize={sizeOf(72)}
        color="#161311"
        anchorX="left"
        anchorY="bottom-baseline"
        sdfGlyphSize={sdf}
        characters={GLYPHS}
      >
        {title}
      </Text>
      <Text
        position={[xOf(80), yOf(360), 0.02]}
        fontSize={sizeOf(36)}
        color="#5E5852"
        anchorX="left"
        anchorY="bottom-baseline"
        sdfGlyphSize={sdf}
        characters={GLYPHS}
      >
        {detail}
      </Text>
      <mesh position={[0, yOf(420), 0.018]}>
        <planeGeometry args={[((PANEL_FACE_WIDTH - 160) / PANEL_FACE_WIDTH) * width, Math.max(0.003, sizeOf(3))]} />
        <meshBasicMaterial
          color={synapse ? "#A30D24" : "#2A2420"}
          transparent
          opacity={0.35}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function GlassPanel({ index }: { index: number }) {
  const group = useRef<Group>(null);
  const glass = useRef<Mesh>(null);
  const foreignCard = useRef<Mesh>(null);
  const synapseCard = useRef<Mesh>(null);
  const foreignCopy = useRef<Group>(null);
  const synapseCopy = useRef<Group>(null);

  const maps = useMemo(() => {
    const panelId = (["feeling", "medications", "appointments", "emergency", "records"] as PanelId[])[index];
    const dpr = typeof window === "undefined" ? 2 : window.devicePixelRatio || 1;
    const scale = panelTextureScale(dpr, sceneBridge.mobile);
    return {
      id: panelId,
      foreign: sharedFill(false, scale),
      synapse: sharedFill(true, scale),
      tint: new Color(panelFaces[panelId].tint),
    };
  }, [index]);

  const high = sceneBridge.quality === "high";
  const def = PANEL_DEFS[index];
  const width = def.width;
  const height = def.height;
  const body = useMemo(
    () => roundedFace(width, height, 0.02, Math.min(width, height) * 0.08, high ? 12 : 8),
    [width, height, high],
  );

  useFrame(() => {
    const pose = sceneBridge.sample?.panels[index];
    const node = group.current;
    if (!pose || !node) return;
    node.position.set(pose.position.x, pose.position.y, pose.position.z);
    node.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);
    node.scale.set(pose.scale.x, pose.scale.y, pose.scale.z);
    node.visible = pose.opacity > 0.025;

    const material = glass.current?.material;
    if (material && !Array.isArray(material)) {
      const mixed = maps.tint.clone().lerp(burgundy, pose.synapseMix);
      if (material instanceof MeshPhysicalMaterial || material instanceof MeshStandardMaterial) {
        material.color.copy(mixed);
        material.opacity = pose.opacity;
        material.transparent = true;
      }
    }
    const foreign = (1 - pose.synapseMix) * pose.opacity;
    const synapse = pose.synapseMix * pose.opacity;
    setOpacity(foreignCard.current, foreign);
    setOpacity(synapseCard.current, synapse);
    fadeCopy(foreignCopy.current, foreign);
    fadeCopy(synapseCopy.current, synapse);
  });

  return (
    <group
      ref={(node) => {
        group.current = node;
        panelGroups[index] = node;
      }}
    >
      <mesh ref={glass} geometry={body}>
        {high ? (
          <meshPhysicalMaterial
            color={maps.tint}
            transmission={0.86}
            thickness={0.4}
            roughness={0.12}
            metalness={0}
            ior={1.45}
            clearcoat={1}
            clearcoatRoughness={0.2}
            attenuationColor={maps.tint}
            attenuationDistance={0.85}
            transparent
            opacity={1}
            envMapIntensity={0.75}
          />
        ) : (
          <meshStandardMaterial color={maps.tint} transparent opacity={0.5} roughness={0.25} metalness={0} />
        )}
      </mesh>
      <mesh ref={foreignCard} position={[0, 0, 0.012]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={maps.foreign} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={synapseCard} position={[0, 0, 0.013]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={maps.synapse} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={foreignCopy}>
        <FaceCopy id={maps.id} synapse={false} width={width} height={height} />
      </group>
      <group ref={synapseCopy} visible={false}>
        <FaceCopy id={maps.id} synapse width={width} height={height} />
      </group>
    </group>
  );
}

function setOpacity(mesh: Mesh | null, opacity: number) {
  if (!mesh) return;
  const material = mesh.material;
  if (!Array.isArray(material) && material instanceof MeshBasicMaterial) {
    material.opacity = opacity;
    material.transparent = true;
  }
  mesh.visible = opacity > 0.03;
}

function fadeCopy(group: Group | null, opacity: number) {
  if (!group) return;
  group.visible = opacity > 0.03;
  group.traverse((obj) => {
    const mesh = obj as Mesh & { material?: MeshBasicMaterial | MeshBasicMaterial[] };
    const material = mesh.material;
    if (!material || Array.isArray(material)) return;
    const shader = material as MeshBasicMaterial & {
      uniforms?: { uTroikaFillOpacity?: { value: number } };
      userData: { baseOpacity?: number };
    };
    if (shader.userData.baseOpacity == null) shader.userData.baseOpacity = shader.opacity > 0 ? shader.opacity : 1;
    const next = shader.userData.baseOpacity * opacity;
    if (shader.uniforms?.uTroikaFillOpacity) shader.uniforms.uTroikaFillOpacity.value = next;
    shader.opacity = next;
    shader.transparent = true;
    shader.depthWrite = false;
    shader.toneMapped = false;
  });
}

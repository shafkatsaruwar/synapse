"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
} from "three";
import { panelGroups, sceneBridge } from "@/lib/animation/bridge";
import { PANEL_FACE_HEIGHT, PANEL_FACE_WIDTH, drawPanelFace, panelFaces, panelTextureScale } from "@/lib/screens/draw";
import { PANEL_DEFS, type PanelId } from "@/lib/animation/scene-sample";

const burgundy = new Color("#f4e6e8");

function makeTexture(id: PanelId, synapse: boolean, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PANEL_FACE_WIDTH * scale);
  canvas.height = Math.round(PANEL_FACE_HEIGHT * scale);
  drawPanelFace(canvas, id, synapse);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 16;
  map.generateMipmaps = true;
  map.minFilter = LinearMipmapLinearFilter;
  map.magFilter = LinearFilter;
  map.needsUpdate = true;
  return map;
}

export function GlassPanel({ index }: { index: number }) {
  const group = useRef<Group>(null);
  const glass = useRef<Mesh>(null);
  const foreign = useRef<Mesh>(null);
  const synapse = useRef<Mesh>(null);

  const maps = useMemo(() => {
    const panelId = (["feeling", "medications", "appointments", "emergency", "records"] as PanelId[])[index];
    const dpr = typeof window === "undefined" ? 2 : window.devicePixelRatio || 1;
    const scale = panelTextureScale(dpr, sceneBridge.mobile);
    return {
      id: panelId,
      foreign: makeTexture(panelId, false, scale),
      synapse: makeTexture(panelId, true, scale),
      tint: new Color(panelFaces[panelId].tint),
    };
  }, [index]);

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
    setOpacity(foreign.current, (1 - pose.synapseMix) * pose.opacity);
    setOpacity(synapse.current, pose.synapseMix * pose.opacity);
  });

  const high = sceneBridge.quality === "high";
  const def = PANEL_DEFS[index];
  const width = def.width;
  const height = def.height;

  return (
    <group
      ref={(node) => {
        group.current = node;
        panelGroups[index] = node;
      }}
    >
      <mesh ref={glass}>
        <boxGeometry args={[width, height, 0.02]} />
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
      <mesh ref={foreign} position={[0, 0, 0.012]}>
        <planeGeometry args={[width * 0.94, height * 0.94]} />
        <meshBasicMaterial map={maps.foreign} transparent opacity={1} depthWrite={false} />
      </mesh>
      <mesh ref={synapse} position={[0, 0, 0.013]}>
        <planeGeometry args={[width * 0.94, height * 0.94]} />
        <meshBasicMaterial map={maps.synapse} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function setOpacity(mesh: Mesh | null, opacity: number) {
  if (!mesh) return;
  const material = mesh.material;
  if (!Array.isArray(material) && material instanceof MeshBasicMaterial) {
    material.opacity = opacity;
  }
  mesh.visible = opacity > 0.03;
}

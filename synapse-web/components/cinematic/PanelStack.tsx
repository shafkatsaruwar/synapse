"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Mesh } from "three";
import { sceneBridge } from "@/lib/animation/bridge";

/** Soft contact shadows between settled glass layers. The layers themselves are the panels. */
export function PanelStack() {
  const refs = useRef<(Mesh | null)[]>([]);

  useFrame(() => {
    const sample = sceneBridge.sample;
    if (!sample) return;
    sample.panels.forEach((panel, index) => {
      const mesh = refs.current[index];
      if (!mesh) return;
      const flat = Math.abs(panel.rotation.x + Math.PI / 2) < 0.4;
      const show = flat && panel.opacity > 0.35 && sample.phase !== "INTRO" && sample.phase !== "SCATTERED";
      mesh.visible = show;
      mesh.position.set(panel.position.x, Math.max(0.09, panel.position.y - 0.028), panel.position.z);
      const material = mesh.material;
      if (!Array.isArray(material) && "opacity" in material) {
        material.opacity = 0.16 * panel.opacity;
      }
    });
  });

  return (
    <group>
      {Array.from({ length: 5 }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <circleGeometry args={[0.62, 24]} />
          <meshBasicMaterial color="#2a211c" transparent opacity={0.14} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

"use client";

import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { PHONE_SIZE } from "@/lib/animation/scene-sample";
import { sceneBridge } from "@/lib/animation/bridge";
import { drawTodayScreen } from "@/lib/screens/draw";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

export function PhoneModel() {
  const screenRef = useRef<Mesh>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 780;
    canvas.height = 1688;
    drawTodayScreen(canvas);
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    map.needsUpdate = true;
    return map;
  }, []);

  const shadow = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
      g.addColorStop(0, "rgba(40, 28, 22, 0.28)");
      g.addColorStop(1, "rgba(40, 28, 22, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
    const map = new CanvasTexture(canvas);
    map.needsUpdate = true;
    return map;
  }, []);

  useFrame(() => {
    const reveal = sceneBridge.sample?.screenReveal ?? 0;
    const material = screenRef.current?.material;
    if (material && !Array.isArray(material) && "opacity" in material) {
      material.opacity = reveal;
    }
  });

  const smooth = sceneBridge.quality === "high" ? 6 : 3;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0.02]}>
        <circleGeometry args={[0.62, 32]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      <RoundedBox
        args={[PHONE_SIZE.width, PHONE_SIZE.thickness, PHONE_SIZE.depth]}
        radius={0.08}
        smoothness={smooth}
        position={[0, PHONE_SIZE.thickness / 2, 0]}
      >
        <meshStandardMaterial color="#1b1b1d" roughness={0.42} metalness={0.12} />
      </RoundedBox>
      <mesh position={[0, PHONE_SIZE.thickness + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.66, 1.4]} />
        <meshStandardMaterial color="#121214" roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh ref={screenRef} position={[0, PHONE_SIZE.thickness + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.64, 1.36]} />
        <meshBasicMaterial map={texture} transparent opacity={0} />
      </mesh>
    </group>
  );
}

"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  CanvasTexture,
  ExtrudeGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
  SRGBColorSpace,
} from "three";
import { sceneBridge } from "@/lib/animation/bridge";
import { PHONE_SIZE } from "@/lib/animation/scene-sample";
import { drawTodayScreen } from "@/lib/screens/draw";

const { width, depth, thickness } = PHONE_SIZE;

function roundedRect(w: number, h: number, radius: number) {
  const shape = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  const r = Math.min(radius, w / 2 - 0.001, h / 2 - 0.001);
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/** Flat slab. Extrusion is along Y after the rotation, sitting on y = 0. */
function slab(w: number, length: number, height: number, radius: number, curve: number) {
  const bevel = Math.min(0.0035, height * 0.22);
  const geometry = new ExtrudeGeometry(roundedRect(Math.max(0.02, w - bevel * 2), Math.max(0.02, length - bevel * 2), radius), {
    depth: Math.max(0.003, height - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: curve,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function roundAlpha(canvas: HTMLCanvasElement, radius: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(w, 0, w, h, radius);
  ctx.arcTo(w, h, 0, h, radius);
  ctx.arcTo(0, h, 0, 0, radius);
  ctx.arcTo(0, 0, w, 0, radius);
  ctx.closePath();
  ctx.fill();
}

export function PhoneModel() {
  const screenRef = useRef<Mesh>(null);
  const high = sceneBridge.quality === "high";
  const curve = high ? 14 : 6;
  const lift = 0.016;

  const body = useMemo(() => slab(width, depth, thickness - 0.012, 0.115, curve), [curve]);
  const glass = useMemo(() => slab(width - 0.05, depth - 0.09, 0.01, 0.092, curve), [curve]);
  const bump = useMemo(() => slab(0.22, 0.22, 0.014, 0.045, Math.max(5, curve - 6)), [curve]);

  const maps = useMemo(() => {
    const screen = document.createElement("canvas");
    screen.width = 780;
    screen.height = 1688;
    drawTodayScreen(screen);
    roundAlpha(screen, 110);
    const screenMap = new CanvasTexture(screen);
    screenMap.colorSpace = SRGBColorSpace;
    screenMap.anisotropy = 8;
    screenMap.needsUpdate = true;

    const gloss = document.createElement("canvas");
    gloss.width = 256;
    gloss.height = 640;
    const gctx = gloss.getContext("2d");
    if (gctx) {
      const gradient = gctx.createLinearGradient(40, 0, 180, 640);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.42, "rgba(255,255,255,0)");
      gradient.addColorStop(0.5, "rgba(255,252,248,0.7)");
      gradient.addColorStop(0.58, "rgba(255,255,255,0)");
      gradient.addColorStop(1, "rgba(255,255,255,0.08)");
      gctx.fillStyle = gradient;
      gctx.fillRect(0, 0, 256, 640);
      roundAlpha(gloss, 40);
    }
    const glossMap = new CanvasTexture(gloss);
    glossMap.needsUpdate = true;

    const shadow = document.createElement("canvas");
    shadow.width = 256;
    shadow.height = 560;
    const sctx = shadow.getContext("2d");
    if (sctx) {
      const radial = sctx.createRadialGradient(128, 280, 20, 128, 280, 160);
      radial.addColorStop(0, "rgba(32, 24, 20, 0.38)");
      radial.addColorStop(0.62, "rgba(32, 24, 20, 0.12)");
      radial.addColorStop(1, "rgba(32, 24, 20, 0)");
      sctx.fillStyle = radial;
      sctx.fillRect(0, 0, 256, 560);
    }
    const shadowMap = new CanvasTexture(shadow);
    shadowMap.needsUpdate = true;
    return { screenMap, glossMap, shadowMap };
  }, []);

  const metal = useMemo(() => {
    const props = { color: "#2e2e32", metalness: 0.88, roughness: 0.26 };
    return high ? new MeshPhysicalMaterial({ ...props, clearcoat: 0.55, clearcoatRoughness: 0.32 }) : new MeshStandardMaterial(props);
  }, [high]);

  const glassMaterial = useMemo(() => {
    if (high) {
      return new MeshPhysicalMaterial({
        color: "#101218",
        metalness: 0.12,
        roughness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        reflectivity: 0.72,
        envMapIntensity: 1.2,
      });
    }
    return new MeshStandardMaterial({ color: "#16181e", metalness: 0.7, roughness: 0.14 });
  }, [high]);

  useFrame(() => {
    const reveal = sceneBridge.sample?.screenReveal ?? 0;
    const material = screenRef.current?.material;
    if (material && !Array.isArray(material) && "opacity" in material) material.opacity = reveal;
  });

  const bodyHeight = thickness - 0.012;
  const faceY = bodyHeight + 0.006;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.02, 0.002, 0.04]}>
        <planeGeometry args={[1.2, 2.25]} />
        <meshBasicMaterial map={maps.shadowMap} transparent depthWrite={false} />
      </mesh>

      <group position={[0, lift, 0]}>
        <mesh geometry={body} material={metal} />
        <mesh geometry={glass} material={glassMaterial} position={[0, bodyHeight - 0.004, 0.02]} />

        <mesh ref={screenRef} position={[0, faceY, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width - 0.072, depth - 0.112]} />
          <meshBasicMaterial map={maps.screenMap} transparent opacity={0} depthWrite={false} />
        </mesh>

        <mesh position={[0.03, faceY + 0.001, 0.01]} rotation={[-Math.PI / 2, 0, 0.4]}>
          <planeGeometry args={[width - 0.14, depth - 0.2]} />
          <meshBasicMaterial map={maps.glossMap} transparent opacity={0.5} depthWrite={false} />
        </mesh>

        <mesh position={[0, faceY + 0.0015, -depth / 2 + 0.15]}>
          <boxGeometry args={[0.155, 0.005, 0.042]} />
          <meshStandardMaterial color="#07080a" metalness={0.15} roughness={0.45} />
        </mesh>
        <mesh position={[-0.028, faceY + 0.003, -depth / 2 + 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.008, 12]} />
          <meshStandardMaterial color="#1a1c22" metalness={0.9} roughness={0.1} />
        </mesh>

        <mesh position={[width / 2 + 0.003, bodyHeight * 0.52, -0.22]}>
          <boxGeometry args={[0.008, 0.016, 0.15]} />
          <meshStandardMaterial color="#8d8d92" metalness={0.92} roughness={0.18} />
        </mesh>
        <mesh position={[width / 2 + 0.003, bodyHeight * 0.52, 0.2]}>
          <boxGeometry args={[0.008, 0.016, 0.09]} />
          <meshStandardMaterial color="#8d8d92" metalness={0.92} roughness={0.18} />
        </mesh>
        <mesh position={[0, bodyHeight * 0.42, depth / 2 + 0.001]}>
          <boxGeometry args={[0.16, 0.006, 0.006]} />
          <meshStandardMaterial color="#0a0a0c" roughness={0.55} />
        </mesh>
      </group>

      <mesh geometry={bump} position={[-width / 2 + 0.18, 0, -depth / 2 + 0.2]}>
        <meshStandardMaterial color="#1c1c1e" metalness={0.75} roughness={0.32} />
      </mesh>
      <mesh position={[-width / 2 + 0.15, 0.001, -depth / 2 + 0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.026, 16]} />
        <meshStandardMaterial color="#0c0e12" metalness={0.9} roughness={0.08} />
      </mesh>
      <mesh position={[-width / 2 + 0.22, 0.001, -depth / 2 + 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.02, 16]} />
        <meshStandardMaterial color="#101218" metalness={0.88} roughness={0.1} />
      </mesh>
    </group>
  );
}

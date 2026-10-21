"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import { ACESFilmicToneMapping } from "three";
import { sceneBridge } from "@/lib/animation/bridge";
import { sampleScene } from "@/lib/animation/scene-sample";
import { CameraRig } from "@/components/cinematic/CameraRig";
import { GlassPanel } from "@/components/cinematic/GlassPanel";
import { PanelStack } from "@/components/cinematic/PanelStack";
import { PhoneModel } from "@/components/cinematic/PhoneModel";
import { SceneLighting } from "@/components/cinematic/SceneLighting";
import { SuspensionString } from "@/components/cinematic/SuspensionString";
import { SynapseScreen } from "@/components/cinematic/SynapseScreen";

function Choreography() {
  const clock = useRef(0);
  useFrame((_, delta) => {
    if (!sceneBridge.locked) clock.current += Math.min(delta, 0.05);
    sceneBridge.sample = sampleScene(sceneBridge.progress, {
      time: sceneBridge.locked ? 0.4 : clock.current,
      mobile: sceneBridge.mobile,
    });
  }, 1);
  return null;
}

function Table() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <circleGeometry args={[14, sceneBridge.quality === "high" ? 64 : 24]} />
      <meshStandardMaterial color="#f3efe8" roughness={0.96} metalness={0} />
    </mesh>
  );
}

export function StudioScene({ active }: { active: boolean }) {
  const mobile = sceneBridge.mobile;
  return (
    <Canvas
      className="studio-canvas"
      camera={{ position: mobile ? [0.04, 2.7, 7.6] : [0.15, 2.08, 6.7], fov: mobile ? 40 : 30, near: 0.08, far: 40 }}
      dpr={mobile ? [1, 1.2] : [1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: !mobile, alpha: false, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#f4f0ea", 1);
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.04;
      }}
    >
      <Choreography />
      <Suspense fallback={null}>
        <SceneLighting />
      </Suspense>
      <CameraRig />
      <Table />
      <PhoneModel />
      <SynapseScreen />
      {Array.from({ length: 5 }, (_, index) => (
        <GlassPanel key={index} index={index} />
      ))}
      {Array.from({ length: 5 }, (_, index) => (
        <SuspensionString key={index} index={index} />
      ))}
      <PanelStack />
    </Canvas>
  );
}

"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { ACESFilmicToneMapping } from "three";
import { sceneBridge } from "@/lib/animation/bridge";
import { sampleScene } from "@/lib/animation/scene-sample";
import { CameraRig } from "@/components/cinematic/CameraRig";
import { GlassPanel, warmPanelTextures } from "@/components/cinematic/GlassPanel";
import { PanelStack } from "@/components/cinematic/PanelStack";
import { PhoneModel, warmPhoneTextures } from "@/components/cinematic/PhoneModel";
import { SceneLighting } from "@/components/cinematic/SceneLighting";
import { SuspensionString } from "@/components/cinematic/SuspensionString";
import { SynapseScreen } from "@/components/cinematic/SynapseScreen";

/** Paint panel and phone textures before the canvas mounts, one face per turn. */
export async function warmStudioAssets() {
  await warmPanelTextures();
  await warmPhoneTextures();
}

function Choreography() {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    sceneBridge.requestRender = () => invalidate();
    invalidate();
    return () => {
      sceneBridge.requestRender = () => {};
    };
  }, [invalidate]);
  // Priority must stay at or below 0. A positive useFrame priority tells
  // react-three-fiber to skip its own render, which leaves the canvas blank.
  // Time is fixed so the same scroll position always returns the same pose.
  useFrame(() => {
    sceneBridge.sample = sampleScene(sceneBridge.progress, {
      time: 0.4,
      mobile: sceneBridge.mobile,
    });
  }, -2);
  return null;
}

function SignalReady({ onReady }: { onReady?: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current || !onReady) return;
    done.current = true;
    onReady();
  });
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

export function StudioScene({ active, onReady }: { active: boolean; onReady?: () => void }) {
  const mobile = sceneBridge.mobile;
  useEffect(() => {
    if (active) sceneBridge.requestRender();
  }, [active]);
  return (
    <Canvas
      className="studio-canvas"
      camera={{ position: mobile ? [0.04, 2.7, 7.6] : [0.15, 2.08, 6.7], fov: mobile ? 40 : 30, near: 0.08, far: 40 }}
      dpr={mobile ? [2, 3] : [1, 2.5]}
      frameloop="demand"
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#f4f0ea", 1);
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.04;
      }}
    >
      <Choreography />
      <SignalReady onReady={onReady} />
      <Suspense fallback={null}>
        <SceneLighting />
      </Suspense>
      <CameraRig />
      <Table />
      <PhoneModel />
      <SynapseScreen />
      <Suspense fallback={null}>
        {Array.from({ length: 5 }, (_, index) => (
          <GlassPanel key={index} index={index} />
        ))}
      </Suspense>
      {Array.from({ length: 5 }, (_, index) => (
        <SuspensionString key={index} index={index} />
      ))}
      <PanelStack />
    </Canvas>
  );
}

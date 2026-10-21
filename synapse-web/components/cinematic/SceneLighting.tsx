"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { sceneBridge } from "@/lib/animation/bridge";

export function SceneLighting() {
  const high = sceneBridge.quality === "high";
  return (
    <>
      <hemisphereLight args={["#fff8f3", "#e7e0d8", 0.55]} />
      <ambientLight intensity={0.35} color="#fff6ee" />
      <directionalLight position={[4.5, 8, 3]} intensity={1.25} color="#fffaf6" />
      <directionalLight position={[-5, 3.5, 2]} intensity={0.28} color="#f3e4e6" />
      {high ? (
        <Environment resolution={128} environmentIntensity={0.45}>
          <Lightformer intensity={3.2} position={[0, 4.5, 2]} scale={[8, 3, 1]} color="#fffaf6" />
          <Lightformer intensity={1.1} position={[-4, 2, -1]} scale={[3, 3, 1]} color="#f6e7ea" />
          <Lightformer intensity={0.6} position={[4, 1.5, -2]} scale={[2, 4, 1]} color="#f3efe8" />
        </Environment>
      ) : null}
    </>
  );
}

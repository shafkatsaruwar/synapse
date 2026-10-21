"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { PerspectiveCamera } from "three";
import { sceneBridge } from "@/lib/animation/bridge";

export function CameraRig() {
  const camera = useThree((state) => state.camera);
  const lastFov = useRef(0);

  useFrame(() => {
    const sample = sceneBridge.sample;
    if (!sample) return;
    camera.position.set(sample.camera.position.x, sample.camera.position.y, sample.camera.position.z);
    camera.lookAt(sample.camera.lookAt.x, sample.camera.lookAt.y, sample.camera.lookAt.z);
    if (camera instanceof PerspectiveCamera && Math.abs(lastFov.current - sample.camera.fov) > 0.05) {
      camera.fov = sample.camera.fov;
      lastFov.current = sample.camera.fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

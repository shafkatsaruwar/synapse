"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { BackSide, Color, Mesh, MeshStandardMaterial, PMREMGenerator, Scene, SphereGeometry } from "three";
import { sceneBridge } from "@/lib/animation/bridge";

export function SceneLighting() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const high = sceneBridge.quality === "high";

  useLayoutEffect(() => {
    if (!high) return;
    const pmrem = new PMREMGenerator(gl);
    const envScene = new Scene();
    envScene.background = new Color("#f6f1ea");
    const geometry = new SphereGeometry(12, 24, 16);
    const material = new MeshStandardMaterial({ color: "#f3eee6", side: BackSide, roughness: 1 });
    envScene.add(new Mesh(geometry, material));
    const previous = gl.getRenderTarget();
    const target = pmrem.fromScene(envScene, 0.06);
    gl.setRenderTarget(previous);
    scene.environment = target.texture;
    return () => {
      scene.environment = null;
      target.texture.dispose();
      pmrem.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [gl, high, scene]);

  return (
    <>
      <hemisphereLight args={["#fff8f3", "#e7e0d8", 0.7]} />
      <ambientLight intensity={0.42} color="#fff6ee" />
      <directionalLight position={[4.5, 8, 3]} intensity={1.35} color="#fffaf6" />
      <directionalLight position={[-5, 3.5, 2]} intensity={0.32} color="#f3e4e6" />
    </>
  );
}

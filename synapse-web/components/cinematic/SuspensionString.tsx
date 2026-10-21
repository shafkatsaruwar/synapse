"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { panelGroups, sceneBridge } from "@/lib/animation/bridge";
import { STRING_ANCHOR_Y } from "@/lib/animation/scene-sample";

const up = new Vector3(0, 1, 0);
const start = new Vector3();
const end = new Vector3();
const mid = new Vector3();
const direction = new Vector3();
const quat = new Quaternion();

export function SuspensionString({ index }: { index: number }) {
  const mesh = useRef<Mesh>(null);

  useFrame(() => {
    const pose = sceneBridge.sample?.panels[index];
    const group = panelGroups[index];
    const node = mesh.current;
    if (!pose || !group || !node) return;
    if (pose.stringDetach > 0.98 || pose.opacity < 0.05) {
      node.visible = false;
      return;
    }
    group.updateWorldMatrix(true, true);
    start.set(0, pose.height / 2, 0);
    group.localToWorld(start);
    const lift = start.y + 0.015;
    const detached = pose.stringDetach;
    end.set(start.x, STRING_ANCHOR_Y, start.z);
    start.y = lift + (STRING_ANCHOR_Y - lift) * detached;
    const length = end.y - start.y;
    if (length < 0.04) {
      node.visible = false;
      return;
    }
    node.visible = true;
    mid.copy(start).add(end).multiplyScalar(0.5);
    direction.copy(end).sub(start).normalize();
    quat.setFromUnitVectors(up, direction);
    node.position.copy(mid);
    node.quaternion.copy(quat);
    node.scale.set(1, length, 1);
    const material = node.material;
    if (!Array.isArray(material) && "opacity" in material) {
      material.opacity = 0.55 * (1 - detached * 0.35);
    }
  });

  return (
    <mesh ref={mesh} visible={false}>
      <cylinderGeometry args={[0.0032, 0.0032, 1, 6]} />
      <meshBasicMaterial color="#5c534c" transparent opacity={0.55} />
    </mesh>
  );
}

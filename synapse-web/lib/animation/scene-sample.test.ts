import assert from "node:assert/strict";
import test from "node:test";
import { PerspectiveCamera, Vector3 } from "three";
import { panelTextureScale } from "../screens/draw.ts";
import {
  PANEL_DEFS,
  PHONE_SIZE,
  PHASES,
  STRING_ANCHOR_Y,
  aabbOf,
  heroCopy,
  panelCorners,
  panelHitsPhone,
  panelsIntersect,
  phaseAt,
  sectionProgress,
  phaseMidpoint,
  sampleScene,
} from "./scene-sample.ts";

function steps(count: number) {
  return Array.from({ length: count + 1 }, (_, i) => i / count);
}

test("phases are ordered, named, and cover 0 to 1", () => {
  const names = [
    "INTRO",
    "SCATTERED",
    "DISCONNECTION",
    "RELEASE",
    "FALL",
    "STACK",
    "ALIGN",
    "MERGE",
    "REVEAL",
  ];
  assert.deepEqual(PHASES.map((phase) => phase.name), names);
  assert.equal(PHASES[0].start, 0);
  assert.equal(PHASES[PHASES.length - 1].end, 1);
  for (let i = 1; i < PHASES.length; i += 1) {
    assert.equal(PHASES[i].start, PHASES[i - 1].end);
    assert.equal(phaseAt(phaseMidpoint(PHASES[i].name)), PHASES[i].name);
  }
});

test("two-panel proof and five-panel scene stay separated until the merge", () => {
  for (const count of [2, 5]) {
    for (const progress of steps(200)) {
      if (progress >= 0.82) continue;
      const sample = sampleScene(progress, { count, time: 0.8 });
      assert.equal(sample.panels.length, count);
      for (const panel of sample.panels) {
        assert.equal(panelHitsPhone(panel), false, `${panel.id} hits phone at ${progress} count ${count}`);
        const box = aabbOf(panelCorners(panel));
        assert.ok(box.max.y < STRING_ANCHOR_Y - 0.4);
      }
      for (let i = 0; i < sample.panels.length; i += 1) {
        for (let j = i + 1; j < sample.panels.length; j += 1) {
          assert.equal(
            panelsIntersect(sample.panels[i], sample.panels[j]),
            false,
            `${sample.panels[i].id} intersects ${sample.panels[j].id} at ${progress} count ${count}`,
          );
        }
      }
    }
  }
});

test("strings are fully released before each panel falls", () => {
  for (const progress of steps(100)) {
    const sample = sampleScene(progress, { count: 5, time: 0 });
    sample.panels.forEach((panel, index) => {
      const fallStart = 0.448 + index * 0.018;
      if (progress >= fallStart - 0.01) {
        assert.ok(panel.stringDetach > 0.95, `${panel.id} still attached at ${progress}`);
      }
      if (progress < 0.36) assert.equal(panel.stringDetach, 0);
    });
  }
});

test("stack is staggered, then alignment centers the layers", () => {
  const stack = sampleScene(0.66, { time: 0 });
  const ys = stack.panels.map((panel) => panel.position.y);
  for (let i = 1; i < ys.length; i += 1) assert.ok(ys[i] - ys[i - 1] > 0.04);
  const xs = stack.panels.map((panel) => panel.position.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.15);

  const aligned = sampleScene(0.815, { time: 0 });
  for (const panel of aligned.panels) {
    assert.ok(Math.abs(panel.position.x) < 0.02);
    assert.ok(Math.abs(panel.position.z) < 0.02);
    assert.ok(panel.synapseMix > 0.9);
  }
});

test("camera motion has no large jumps and the phone screen is revealed at the end", () => {
  let previous = sampleScene(0, { time: 0 });
  for (const progress of steps(100).slice(1)) {
    const next = sampleScene(progress, { time: 0 });
    const dx = next.camera.position.x - previous.camera.position.x;
    const dy = next.camera.position.y - previous.camera.position.y;
    const dz = next.camera.position.z - previous.camera.position.z;
    const jump = Math.hypot(dx, dy, dz);
    assert.ok(jump < 0.55, `camera jump ${jump} at ${progress}`);
    previous = next;
  }
  const reveal = sampleScene(1, { time: 0 });
  assert.ok(reveal.screenReveal > 0.99);
  assert.ok(reveal.panels.every((panel) => panel.opacity === 0));
});

test("hero copy follows the script", () => {
  assert.equal(heroCopy(0.02).title, "Your health. Everywhere.");
  assert.match(heroCopy(0.02).body, /different places/i);
  assert.equal(heroCopy(0.12).title, "Different apps.");
  assert.equal(heroCopy(0.19).title, "Different platforms.");
  assert.equal(heroCopy(0.26).title, "Different places to look.");
  assert.equal(heroCopy(0.33).title, "No more.");
  assert.equal(heroCopy(0.4).title, "No more.");
  assert.equal(heroCopy(0.5).title, "Coming together.");
  assert.equal(heroCopy(0.66).title, "Coming together.");
  assert.equal(heroCopy(0.78).title, "Into one place.");
  assert.equal(heroCopy(0.86).title, "Into one place.");
  assert.equal(heroCopy(0.93).kicker, "Meet Synapse.");
  assert.equal(heroCopy(0.99).title, "Your health life, finally in one place.");
  assert.equal(heroCopy(0).showIntroCta, true);
  assert.equal(heroCopy(0.99).showRevealCta, true);
});

function phoneNdc(camera: { position: { x: number; y: number; z: number }; lookAt: { x: number; y: number; z: number }; fov: number }, aspect: number) {
  const cam = new PerspectiveCamera(camera.fov, aspect, 0.08, 40);
  cam.position.set(camera.position.x, camera.position.y, camera.position.z);
  cam.lookAt(camera.lookAt.x, camera.lookAt.y, camera.lookAt.z);
  cam.updateMatrixWorld();
  const xs = [-PHONE_SIZE.width / 2, PHONE_SIZE.width / 2];
  const ys = [0, PHONE_SIZE.thickness + 0.02];
  const zs = [-PHONE_SIZE.depth / 2, PHONE_SIZE.depth / 2];
  let minX = Infinity;
  let maxX = -Infinity;
  const point = new Vector3();
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        point.set(x, y, z).project(cam);
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
      }
    }
  }
  return { minX, maxX };
}

test("desktop reveal keeps the phone clear of the headline column", () => {
  // Reveal copy is padded 7vw and capped at 40vw, so the column ends at 47% (NDC -0.06).
  const columnEdge = 0.47 * 2 - 1;
  const aspects = [1024 / 768, 1024 / 900, 1280 / 800, 1366 / 768, 1440 / 900, 1536 / 864, 1680 / 1050, 1920 / 1080, 1920 / 1200];
  for (const progress of [0.91, 0.946, 0.98, 1]) {
    const sample = sampleScene(progress, { time: 0, mobile: false });
    for (const aspect of aspects) {
      const box = phoneNdc(sample.camera, aspect);
      assert.ok(
        box.minX > columnEdge + 0.1,
        `phone left ${box.minX.toFixed(3)} meets the headline at ${progress} aspect ${aspect.toFixed(3)}`,
      );
      assert.ok(box.maxX < 0.98, `phone clips the right edge (${box.maxX.toFixed(3)}) at ${progress} aspect ${aspect.toFixed(3)}`);
    }
  }
});

test("panel textures stay at least 2× and reach 3× on a phone", () => {
  assert.equal(panelTextureScale(1, false), 2);
  assert.equal(panelTextureScale(2, false), 2);
  assert.equal(panelTextureScale(2.5, false), 2.5);
  assert.equal(panelTextureScale(4, false), 3);
  assert.equal(panelTextureScale(Number.NaN, false), 2);
  assert.equal(panelTextureScale(1, true), 2);
  assert.equal(panelTextureScale(2, true), 2);
  assert.equal(panelTextureScale(3, true), 3);
  assert.equal(panelTextureScale(4, true), 3);
});

test("section progress is reversible and clamped", () => {
  assert.equal(sectionProgress(0, 720, 100), 0);
  assert.equal(sectionProgress(-310, 720, 100), 0.5);
  assert.equal(sectionProgress(-620, 720, 100), 1);
  assert.equal(sectionProgress(40, 720, 100), 0);
  assert.equal(sectionProgress(-900, 720, 100), 1);
  assert.equal(sectionProgress(0, 80, 100), 0);
});

test("panel catalog has the five suspended identities", () => {
  assert.deepEqual(
    PANEL_DEFS.map((panel) => panel.id),
    ["feeling", "medications", "appointments", "emergency", "records"],
  );
});

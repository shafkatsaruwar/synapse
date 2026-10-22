import assert from "node:assert/strict";
import test from "node:test";
import { drawPanelFace, panelFaceCopy, panelFaces, type PanelId } from "./draw.ts";

const IDS = Object.keys(panelFaces) as PanelId[];

function recordingCanvas(width: number, height: number) {
  const texts: string[] = [];
  const ctx = {
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high" as const,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,
    setTransform() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    fillText(text: string) {
      texts.push(text);
    },
  };
  return {
    width,
    height,
    texts,
    getContext() {
      return ctx;
    },
  };
}

test("every panel face renders its mark, kicker, title, and detail", () => {
  assert.equal(IDS.length, 5);
  for (const id of IDS) {
    for (const synapse of [false, true]) {
      const canvas = recordingCanvas(2048, 1280);
      drawPanelFace(canvas as unknown as HTMLCanvasElement, id, synapse);
      const copy = panelFaceCopy(id, synapse);
      for (const line of [copy.mark, copy.kicker, copy.title, copy.detail]) {
        assert.ok(canvas.texts.includes(line), `${id} synapse=${synapse} missing ${line}`);
      }
    }
  }
});

test("the five hanging titles are distinct on both faces", () => {
  const foreign = IDS.map((id) => panelFaceCopy(id, false).title);
  const synapse = IDS.map((id) => panelFaceCopy(id, true).title);
  assert.deepEqual(new Set(foreign).size, 5);
  assert.deepEqual(new Set(synapse).size, 5);
  assert.deepEqual(foreign, ["Daynote", "Dosebook", "Visitly", "Cardkeep", "Recorda"]);
  assert.ok(synapse.includes("Medications"));
  assert.ok(synapse.includes("Appointments"));
  assert.ok(synapse.includes("Emergency"));
  assert.ok(synapse.includes("Health Records"));
  assert.ok(synapse.includes("How I’m Feeling"));
});

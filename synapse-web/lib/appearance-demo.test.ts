import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  APPEARANCE_ACCENTS,
  APPEARANCE_SURFACES,
  APPEARANCE_THEMES,
  APPEARANCE_WALLPAPERS,
} from "./appearance-demo.ts";

test("appearance studio is a feature and only lists the looks from the app", () => {
  const source = fs.readFileSync(new URL("./feature-content/content.ts", import.meta.url), "utf8");
  const appearance = source.slice(source.indexOf('slug: "appearance"'));
  assert.ok(appearance.length > 0);
  assert.equal(source.split('slug: "appearance"').length, 2);
  assert.match(appearance, /every option is included for everyone/);
  assert.match(appearance, /free for everyone/);
  assert.equal(appearance.includes("Aurora"), false);
  assert.equal(appearance.includes("softGradient"), false);
  assert.equal(appearance.includes("$"), false);
  assert.deepEqual(
    APPEARANCE_THEMES.map((theme) => theme.label),
    ["System", "Light", "Dark", "Evergreen", "Calm", "Blue"],
  );
  assert.deepEqual(
    APPEARANCE_WALLPAPERS.map((paper) => paper.label),
    ["None", "Mist", "Linen", "Cloud"],
  );
  assert.deepEqual(
    APPEARANCE_SURFACES.map((surface) => surface.label),
    ["Solid", "Soft", "Glass"],
  );
  assert.deepEqual(
    APPEARANCE_ACCENTS.map((accent) => accent.label),
    ["Burgundy", "Evergreen", "Blue", "Violet", "Rose", "Amber", "Teal", "Slate"],
  );
});

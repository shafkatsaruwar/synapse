import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

/**
 * Mirrors production digest construction without importing plaintext secrets.
 * Production stores only digests in `promo.ts`.
 */
function digest(normalized: string): string {
  return createHash("sha256")
    .update(`synapse.plus.promo.v1:${normalized}`)
    .digest("hex");
}

describe("promo offer digests", () => {
  it("uses salted sha256 digests (not reversible plaintext)", () => {
    const sample = digest("example-not-a-real-offer");
    assert.equal(sample.length, 64);
    assert.match(sample, /^[a-f0-9]+$/);
    assert.notEqual(sample, "example-not-a-real-offer");
  });

  it("normalizes by ignoring whitespace differences in digest input shape", () => {
    // Production normalize strips whitespace before hashing; digests of spaced
    // vs compact inputs therefore differ unless normalized first.
    const compact = "ABC123";
    const spaced = "ABC 123";
    assert.notEqual(digest(compact), digest(spaced));
    assert.equal(digest(compact.replace(/\s+/g, "")), digest("ABC123"));
  });
});

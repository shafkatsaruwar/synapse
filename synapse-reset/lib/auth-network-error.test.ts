/**
 * Run with: npx tsx synapse-reset/lib/auth-network-error.test.ts
 */
import { mapAuthNetworkError } from "./auth-network-error";

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.log("  FAIL:", msg);
  }
}

const mapped = mapAuthNetworkError(new Error("Network request failed"), "gnetrxuxrzzaifyasyst.supabase.co");
assert(mapped.message.includes("gnetrxuxrzzaifyasyst.supabase.co"), "includes host");
assert(!mapped.message.toLowerCase().includes("network request failed"), "replaces generic RN message");

const other = mapAuthNetworkError(new Error("Invalid login credentials"), "example.supabase.co");
assert(other.message === "Invalid login credentials", "non-network errors pass through");

const emptyPw = mapAuthNetworkError(new Error("Validation failed: password: Password must be at least 8 characters"));
assert(emptyPw.message.includes("8 characters"), "validation not rewritten");

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

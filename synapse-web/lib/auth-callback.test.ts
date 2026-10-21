import assert from "node:assert/strict";
import test from "node:test";
import { readAuthCallback, stripAuthParams } from "./auth-callback.ts";

test("a normal marketing URL is not an auth callback", () => {
  assert.deepEqual(readAuthCallback("https://synapse-health.vercel.app/"), { present: false, recovery: false });
  assert.deepEqual(readAuthCallback("https://synapse-health.vercel.app/features"), { present: false, recovery: false });
});

test("sign-up hash tokens are detected and removed without being returned", () => {
  const href = "https://synapse-health.vercel.app/#access_token=secret-token&refresh_token=also-secret&type=signup";
  const result = readAuthCallback(href);
  assert.deepEqual(result, { present: true, recovery: false });
  assert.equal(JSON.stringify(result).includes("secret-token"), false);
  assert.equal(stripAuthParams(href), "/");
});

test("recovery links are distinguished from confirmation links", () => {
  assert.deepEqual(readAuthCallback("https://synapse-health.vercel.app/#access_token=abc&type=recovery"), {
    present: true,
    recovery: true,
  });
  assert.deepEqual(readAuthCallback("https://synapse-health.vercel.app/reset-password#access_token=abc&type=recovery"), {
    present: true,
    recovery: true,
  });
  assert.equal(stripAuthParams("https://synapse-health.vercel.app/reset-password?code=pkce-code&type=recovery"), "/reset-password");
});

test("an expired confirmation error is a callback and its description is stripped", () => {
  const href = "https://synapse-health.vercel.app/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid";
  assert.deepEqual(readAuthCallback(href), { present: true, recovery: false });
  assert.equal(stripAuthParams(href), "/");
});

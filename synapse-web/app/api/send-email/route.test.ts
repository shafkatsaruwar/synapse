import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, test } from "node:test";
import { handleSendEmail } from "../../../lib/send-email-handler.ts";

const rootModules = path.resolve("..", "node_modules");
fs.mkdirSync(rootModules, { recursive: true });
const resendLink = path.join(rootModules, "resend");
if (!fs.existsSync(resendLink)) {
  fs.symlinkSync(path.resolve("node_modules/resend"), resendLink, "dir");
}

const originalModule = await import(pathToFileURL(path.resolve("..", "api/send-email.ts")).href);
const originalHandler = originalModule.default as (
  req: { method?: string; headers: Record<string, string | undefined>; body?: unknown },
  res: { status: (code: number) => { json: (data: unknown) => void }; json: (data: unknown) => void },
) => Promise<void>;

const ENV_KEYS = ["API_SHARED_SECRET", "RESEND_API_KEY", "RESEND_FROM_EMAIL"] as const;

async function withEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, run: () => Promise<void>) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    await run();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function installFetch(response: Response) {
  const payloads: unknown[] = [];
  const previous = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof init?.body === "string") payloads.push(JSON.parse(init.body));
    return response.clone();
  }) as typeof fetch;
  return {
    payloads,
    restore() {
      globalThis.fetch = previous;
    },
  };
}

async function callOriginal(method: string, headers: Record<string, string | undefined>, body: unknown, fetchResponse: Response) {
  let status = 200;
  let payload: unknown;
  const sent = installFetch(fetchResponse);
  try {
    await originalHandler(
      { method, headers, body },
      {
        status(code: number) {
          status = code;
          return this;
        },
        json(data: unknown) {
          payload = data;
          return this;
        },
      },
    );
  } finally {
    sent.restore();
  }
  return { status, body: payload === undefined ? payload : JSON.parse(JSON.stringify(payload)), payloads: sent.payloads };
}

async function callNext(method: string, headers: Record<string, string | undefined>, body: unknown, fetchResponse: Response) {
  const init: RequestInit = { method, headers: headers as HeadersInit };
  if (body !== undefined) init.body = JSON.stringify(body);
  const request = new Request("https://synapse-health.vercel.app/api/send-email", init);
  const sent = installFetch(fetchResponse);
  try {
    const result = await handleSendEmail(request);
    return {
      status: result.status,
      body: JSON.parse(JSON.stringify(result.body)),
      payloads: sent.payloads,
    };
  } finally {
    sent.restore();
  }
}

describe("send-email matches api/send-email.ts", { concurrency: false }, () => {
  test("methods, auth, validation, and Resend results match", async () => {
    const ok = () => Response.json({ id: "email_123" });
    const cases: {
      name: string;
      method: string;
      headers?: Record<string, string | undefined>;
      body?: unknown;
      env: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;
      fetchResponse?: () => Response;
    }[] = [
      { name: "GET is 405", method: "GET", env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "PUT is 405", method: "PUT", env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "PATCH is 405", method: "PATCH", env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "DELETE is 405", method: "DELETE", env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "OPTIONS is 405", method: "OPTIONS", env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "HEAD is 405", method: "HEAD", env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "missing secret is 503", method: "POST", body: { to: "a@example.com", subject: "Hello" }, env: {} },
      { name: "blank secret is 503", method: "POST", body: { to: "a@example.com", subject: "Hello" }, env: { API_SHARED_SECRET: "   " } },
      { name: "no credentials is 401", method: "POST", body: { to: "a@example.com", subject: "Hello" }, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "wrong api key is 401", method: "POST", headers: { "x-api-key": "nope" }, body: { to: "a@example.com", subject: "Hello" }, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "wrong bearer is 401", method: "POST", headers: { authorization: "Bearer nope" }, body: { to: "a@example.com", subject: "Hello" }, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "api key wins over a correct bearer", method: "POST", headers: { "x-api-key": "wrong", authorization: "Bearer secret" }, body: { to: "a@example.com", subject: "Hello" }, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "trimmed api key is accepted", method: "POST", headers: { "x-api-key": "  secret  " }, body: { to: "a@example.com", subject: "Hello" }, env: { API_SHARED_SECRET: " secret ", RESEND_API_KEY: "re_test" } },
      { name: "bearer case is ignored", method: "POST", headers: { authorization: "bearer secret" }, body: { to: "a@example.com", subject: "Hello" }, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "correct bearer is accepted when no api key", method: "POST", headers: { authorization: "Bearer secret" }, body: { to: "a@example.com", subject: "Hello" }, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "missing resend key is 500", method: "POST", headers: { "x-api-key": "secret" }, body: { to: "a@example.com", subject: "Hello" }, env: { API_SHARED_SECRET: "secret" } },
      { name: "missing to is 400", method: "POST", headers: { "x-api-key": "secret" }, body: { subject: "Hello" }, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "missing subject is 400", method: "POST", headers: { "x-api-key": "secret" }, body: { to: "a@example.com" }, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "null body is 500", method: "POST", headers: { "x-api-key": "secret" }, body: null, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "string recipient uses the default from and html", method: "POST", headers: { "x-api-key": "secret" }, body: { to: "a@example.com", subject: "Hello", from: "Ignored <ignored@example.com>" }, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" } },
      { name: "array recipient keeps html and RESEND_FROM_EMAIL", method: "POST", headers: { "x-api-key": "secret" }, body: { to: ["a@example.com", "b@example.com"], subject: "Hello", html: "<p>Hi</p>" }, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "Synapse <hello@example.com>" } },
      { name: "resend error message is 400", method: "POST", headers: { "x-api-key": "secret" }, body: { to: "a@example.com", subject: "Hello" }, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" }, fetchResponse: () => Response.json({ message: "Invalid `to` field", name: "validation_error" }, { status: 422 }) },
      { name: "missing id still succeeds", method: "POST", headers: { "x-api-key": "secret" }, body: { to: "a@example.com", subject: "Hello" }, env: { API_SHARED_SECRET: "secret", RESEND_API_KEY: "re_test" }, fetchResponse: () => Response.json({}, { status: 200 }) },
    ];

    const logged = console.error;
    console.error = () => undefined;
    try {
      for (const item of cases) {
        await withEnv(item.env, async () => {
          const makeResponse = item.fetchResponse ?? ok;
          const original = await callOriginal(item.method, item.headers ?? {}, item.body, makeResponse());
          const next = await callNext(item.method, item.headers ?? {}, item.body, makeResponse());
          assert.equal(next.status, original.status, item.name);
          assert.deepEqual(next.body, original.body, item.name);
          assert.deepEqual(next.payloads, original.payloads, `${item.name} payload`);
        });
      }
    } finally {
      console.error = logged;
    }
  });
});

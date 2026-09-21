import { test } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createAppServer } from "../src/server.js";
import type { AppServerOptions } from "../src/server.js";
import { createChangeService } from "../src/application/change-service.js";
import { MAX_INPUT_BYTES, MAX_REQUEST_BYTES } from "../src/limits.js";

async function start(t: TestContext, options: AppServerOptions = {}) {
  const server = createAppServer(options);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    base,
    post: (body: unknown) =>
      fetch(`${base}/api/change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
}

test("HTTP adapter shares file calculation, defaults, EUR and divisor settings", async (t) => {
  const { post } = await start(t);
  const response = await post({ input: "2.12,3.00\n1.97,2.00\n" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    output: "3 quarters,1 dime,3 pennies\n3 pennies\n",
  });
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cache-control"), "no-store");
  const eur = await post({ input: "3.33,5.00", currency: "EUR", divisor: 5 });
  assert.deepEqual(await eur.json(), {
    output:
      "1 1-euro coin,1 50-cent coin,1 10-cent coin,1 5-cent coin,1 2-cent coin\n",
  });
  assert.deepEqual(await (await post({ input: "" })).json(), { output: "" });
});

test("headless service exposes calculation and health without requiring built UI assets", async (t) => {
  let ready = true;
  const { post, base } = await start(t, {
    serveWeb: false,
    webRoot: "/nonexistent-assets",
    isReady: () => ready,
  });
  assert.equal((await fetch(base)).status, 404);
  assert.equal((await post({ input: "1.00,1.00" })).status, 200);
  for (const path of ["/health/live", "/health/ready"]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    const wrongMethod = await fetch(`${base}${path}`, { method: "POST" });
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get("allow"), "GET");
  }
  ready = false;
  assert.equal((await fetch(`${base}/health/ready`)).status, 503);
  assert.equal((await fetch(`${base}/health/live`)).status, 200);
  assert.equal((await post({ input: "1.00,1.00" })).status, 503);
});

test("HTTP calls an injected async service and propagates bounded request IDs", async (t) => {
  const { base } = await start(t, {
    service: {
      async calculate(command, context) {
        assert.deepEqual(command, {
          input: "1.00,2.00",
          currency: "USD",
          divisor: 3,
        });
        assert.ok(!context.signal.aborted);
        return { output: context.requestId };
      },
    },
  });
  for (const id of ["checkout-123", "x".repeat(129), "unsafe/id"]) {
    const response = await fetch(`${base}/api/change`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-ID": id },
      body: JSON.stringify({ input: "1.00,2.00" }),
    });
    const received = response.headers.get("x-request-id");
    assert.deepEqual(await response.json(), { output: received });
    if (id === "checkout-123") assert.equal(received, id);
    else assert.match(received!, /^[0-9a-f-]{36}$/);
  }
});

test("dependency and unexpected errors use distinct statuses without exposing adapter details", async (t) => {
  const service = createChangeService({
    repository: {
      async save() {
        throw new Error("private DB credentials");
      },
    },
  });
  const { post } = await start(t, { service });
  const unavailable = await post({ input: "1.00,1.00" });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), {
    error: "A required service dependency is unavailable.",
  });
  const unexpected = await start(t, {
    service: {
      async calculate() {
        throw new Error("private upstream details");
      },
    },
  });
  const failure = await unexpected.post({ input: "1.00,1.00" });
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { error: "Unexpected server error." });
});

test("deadline aborts a slow service and returns 504 even if it ignores cancellation", async (t) => {
  let signal: AbortSignal | undefined;
  const { post } = await start(t, {
    requestTimeoutMs: 30,
    service: {
      async calculate(_command, context) {
        signal = context.signal;
        return new Promise(() => {});
      },
    },
  });
  const response = await post({ input: "1.00,1.00" });
  assert.equal(response.status, 504);
  assert.ok(signal?.aborted);
});

test(
  "client disconnect aborts the context supplied to a future adapter",
  { timeout: 5000 },
  async (t) => {
    let started!: () => void;
    let cancelled!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const cancellation = new Promise<void>((resolve) => {
      cancelled = resolve;
    });
    const { base } = await start(t, {
      service: {
        async calculate(_command, context) {
          context.signal.addEventListener("abort", cancelled, { once: true });
          started();
          return new Promise(() => {});
        },
      },
    });
    const controller = new AbortController();
    const pending = fetch(`${base}/api/change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "1.00,1.00" }),
      signal: controller.signal,
    });
    await ready;
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
    await cancellation;
  },
);

test("API rejects malformed contracts, invalid money and unsupported settings", async (t) => {
  const { post, base } = await start(t);
  for (const body of [
    null,
    [],
    "bad",
    {},
    { input: 1 },
    { input: "", extra: true },
    { input: "", currency: "GBP" },
    { input: "", currency: null },
    { input: "", divisor: "3" },
    { input: "", divisor: null },
  ]) {
    assert.equal((await post(body)).status, 400, JSON.stringify(body));
  }
  for (const divisor of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal((await post({ input: "2.12,3.00", divisor })).status, 422);
  const invalid = await post({ input: "2.12,3.00\n2.001,3.00" });
  assert.equal(invalid.status, 422);
  assert.match(((await invalid.json()) as { error: string }).error, /Line 2:/);
  assert.equal(
    (await fetch(`${base}/api/change`, { method: "POST", body: "{}" })).status,
    415,
  );
  assert.equal(
    (
      await fetch(`${base}/api/change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      })
    ).status,
    400,
  );
  assert.equal((await fetch(`${base}/api/change`)).status, 405);
});

test("HTTP limits apply to both input text and request bytes", async (t) => {
  const { post, base } = await start(t);
  assert.equal(
    (await post({ input: "x".repeat(MAX_INPUT_BYTES + 1) })).status,
    413,
  );
  assert.equal(
    (
      await fetch(`${base}/api/change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "x".repeat(MAX_REQUEST_BYTES + 1),
      })
    ).status,
    413,
  );
});

test("static server serves the built UI and does not expose repository files", async (t) => {
  const { base } = await start(t);
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(
    page.headers.get("content-security-policy")!,
    /frame-ancestors 'none'/,
  );
  const html = await page.text();
  assert.match(html, /Cash Register/);
  const asset = html.match(/src="([^"]+\.js)"/)![1]!;
  const script = await fetch(`${base}${asset}`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type")!, /javascript/);
  for (const path of [
    "/package.json",
    "/.git/config",
    "/missing.js",
    "/%2e%2e%2fpackage.json",
  ])
    assert.equal((await fetch(`${base}${path}`)).status, 404);
  assert.equal((await fetch(`${base}/%zz`)).status, 400);
});

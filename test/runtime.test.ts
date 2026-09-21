import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { readConfig } from "../src/config.js";
import { createServiceRuntime } from "../src/runtime.js";

test("shutdown drains active work before closing adapters, and repeated stop is harmless", async (t) => {
  const events: string[] = [];
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const runtime = createServiceRuntime(readConfig({}), {
    service: {
      async calculate() {
        entered();
        await gate;
        events.push("calculated");
        return { output: "No change due\n" };
      },
    },
    async dispose() {
      events.push("disposed");
    },
  });
  await new Promise<void>((resolve) =>
    runtime.server.listen(0, "127.0.0.1", resolve),
  );
  t.after(() => {
    runtime.server.closeAllConnections();
    runtime.server.close();
  });
  const port = (runtime.server.address() as AddressInfo).port;
  const pending = fetch(`http://127.0.0.1:${port}/api/change`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: "1.00,1.00" }),
  });
  await started;
  const stopping = runtime.stop();
  assert.equal(runtime.stop(), stopping);
  assert.equal(runtime.server.listening, false);
  assert.deepEqual(events, []);
  release();
  assert.deepEqual(await (await pending).json(), { output: "No change due\n" });
  await stopping;
  assert.deepEqual(events, ["calculated", "disposed"]);
});

test("shutdown deadline also bounds adapter cleanup", async () => {
  const runtime = createServiceRuntime(
    readConfig({ SHUTDOWN_TIMEOUT_MS: "30" }),
    {
      dispose: () => new Promise(() => {}),
    },
  );
  await assert.rejects(runtime.stop(), /shutdown deadline exceeded/);
});

test("runtime readiness can reflect future adapter state without affecting liveness", async (t) => {
  let ready = false;
  const runtime = createServiceRuntime(readConfig({ SERVE_WEB: "false" }), {
    isReady: () => ready,
  });
  await new Promise<void>((resolve) =>
    runtime.server.listen(0, "127.0.0.1", resolve),
  );
  t.after(() => runtime.stop());
  const base = `http://127.0.0.1:${(runtime.server.address() as AddressInfo).port}`;
  assert.equal((await fetch(`${base}/health/live`)).status, 200);
  assert.equal((await fetch(`${base}/health/ready`)).status, 503);
  ready = true;
  assert.equal((await fetch(`${base}/health/ready`)).status, 200);
});

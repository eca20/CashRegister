import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createChangeService,
  DependencyUnavailableError,
  InvalidCalculationError,
} from "../src/application/change-service.js";
import type {
  CalculationRecord,
  CallContext,
} from "../src/application/change-service.js";
import { readConfig } from "../src/config.js";

const request = { input: "2.12,3.00", currency: "USD", divisor: 3 } as const;
const context = (): CallContext => ({
  requestId: "test-request",
  signal: new AbortController().signal,
});

test("default application service uses the existing core without a repository", async () => {
  assert.deepEqual(await createChangeService().calculate(request, context()), {
    output: "3 quarters,1 dime,3 pennies\n",
  });
});

test("optional repository receives an immutable request/result snapshot and must finish before success", async () => {
  const records: CalculationRecord[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const caller = context();
  const service = createChangeService({
    repository: {
      async save(record, receivedContext) {
        assert.equal(receivedContext, caller);
        assert.ok(Object.isFrozen(record));
        records.push(record);
        await gate;
      },
    },
  });
  const mutable = { ...request, input: String(request.input) };
  let settled = false;
  const pending = service.calculate(mutable, caller).then((result) => {
    settled = true;
    return result;
  });
  // The stored record must not track later caller mutations across the await.
  mutable.input = "invalid";
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    ...request,
    output: "3 quarters,1 dime,3 pennies\n",
    requestId: caller.requestId,
    calculatedAt: records[0]!.calculatedAt,
  });
  assert.ok(Number.isFinite(Date.parse(records[0]!.calculatedAt)));
  release();
  assert.deepEqual(await pending, { output: records[0]!.output });
});

test("invalid complete batches never reach the repository", async () => {
  let saves = 0;
  const service = createChangeService({
    repository: {
      async save() {
        saves++;
      },
    },
  });
  await assert.rejects(
    service.calculate({ ...request, input: "2.12,3.00\n4.00,2.00" }, context()),
    InvalidCalculationError,
  );
  await assert.rejects(
    service.calculate({ ...request, divisor: 0 }, context()),
    InvalidCalculationError,
  );
  assert.equal(saves, 0);
});

test("repository failure is explicit and keeps the private cause out of the public message", async () => {
  const cause = new Error("database password / connection details");
  const service = createChangeService({
    repository: {
      async save() {
        throw cause;
      },
    },
  });
  await assert.rejects(
    service.calculate(request, context()),
    (error: unknown) => {
      assert.ok(error instanceof DependencyUnavailableError);
      assert.equal(error.cause, cause);
      assert.equal(error.message, "Calculation storage is unavailable.");
      return true;
    },
  );
});

test("cancellation is propagated before work and after an asynchronous save", async () => {
  const controller = new AbortController();
  const caller = { requestId: "cancelled", signal: controller.signal };
  let saves = 0;
  const service = createChangeService({
    repository: {
      async save(_record, received) {
        assert.equal(received.signal, controller.signal);
        saves++;
        controller.abort();
      },
    },
  });
  await assert.rejects(service.calculate(request, caller), {
    name: "AbortError",
  });
  assert.equal(saves, 1);
  await assert.rejects(service.calculate(request, caller), {
    name: "AbortError",
  });
  assert.equal(saves, 1);
});

test("service configuration has safe defaults, supports headless mode and rejects malformed values", () => {
  assert.deepEqual(readConfig({}), {
    host: "127.0.0.1",
    port: 3000,
    serveWeb: true,
    requestTimeoutMs: 10000,
    shutdownTimeoutMs: 15000,
  });
  assert.deepEqual(
    readConfig({
      HOST: "0.0.0.0",
      PORT: "8080",
      SERVE_WEB: "false",
      REQUEST_TIMEOUT_MS: "2500",
      SHUTDOWN_TIMEOUT_MS: "4000",
    }),
    {
      host: "0.0.0.0",
      port: 8080,
      serveWeb: false,
      requestTimeoutMs: 2500,
      shutdownTimeoutMs: 4000,
    },
  );
  for (const env of [
    { PORT: "0" },
    { PORT: "65536" },
    { PORT: "1e3" },
    { PORT: "" },
    { HOST: " " },
    { HOST: " localhost" },
    { SERVE_WEB: "yes" },
    { REQUEST_TIMEOUT_MS: "-1" },
    { REQUEST_TIMEOUT_MS: "1.5" },
    { SHUTDOWN_TIMEOUT_MS: "120001" },
  ])
    assert.throws(() => readConfig(env));
});

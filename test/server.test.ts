import { test } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createAppServer } from "../src/server.js";
import { MAX_INPUT_BYTES, MAX_REQUEST_BYTES } from "../src/limits.js";

async function start(t: TestContext) {
  const server = createAppServer();
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

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runCli } from "../src/cli.js";
import { MAX_INPUT_BYTES } from "../src/limits.js";

test("built CLI processes a real multi-line file with no stdout noise", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "register-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, "transactions.txt"),
    output = join(dir, "change.txt");
  await writeFile(input, "2.12,3.00\n1.97,2.00\n3.33,5.00\n");
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../src/main.js", import.meta.url)), input, output],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
  const lines = (await readFile(output, "utf8")).trimEnd().split("\n");
  assert.equal(lines.length, 3);
  assert.equal(lines[0], "3 quarters,1 dime,3 pennies");
  assert.equal(lines[1], "3 pennies");
  const values: Record<string, number> = {
    dollar: 100,
    dollars: 100,
    quarter: 25,
    quarters: 25,
    dime: 10,
    dimes: 10,
    nickel: 5,
    nickels: 5,
    penny: 1,
    pennies: 1,
  };
  assert.equal(
    lines[2]!.split(",").reduce((sum, item) => {
      const [count, name] = item.split(" ");
      assert.ok(
        values[name!] && Number.isInteger(Number(count)) && Number(count) > 0,
      );
      return sum + Number(count) * values[name!]!;
    }, 0),
    167,
  );
});

test("CLI options reach the shared core and report missing/invalid/duplicate options", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "register-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, "in"),
    output = join(dir, "out");
  await writeFile(input, "3.33,5.00");
  assert.equal(
    await runCli([input, output, "--currency", "EUR", "--divisor", "5"]),
    0,
  );
  assert.equal(
    await readFile(output, "utf8"),
    "1 1-euro coin,1 50-cent coin,1 10-cent coin,1 5-cent coin,1 2-cent coin\n",
  );
  for (const args of [
    [],
    [input],
    [input, output, "extra"],
    [input, output, "--bad"],
    [input, output, "--currency"],
    [input, output, "--currency", "GBP"],
    [input, output, "--divisor", "0"],
    [input, output, "--divisor", "1.5"],
    [input, output, "--divisor", "999999999999999999"],
    [input, output, "--currency", "USD", "--currency", "EUR"],
  ]) {
    let stderr = "";
    assert.equal(
      await runCli(
        args,
        () => {},
        (text) => {
          stderr += text;
        },
      ),
      2,
    );
    assert.match(stderr, /Usage:/);
  }
});

test("invalid later row creates no output; existing output and input cannot be overwritten", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "register-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, "in"),
    output = join(dir, "out");
  await writeFile(input, "2.12,3.00\n1.00,0.99");
  let stderr = "";
  assert.equal(
    await runCli(
      [input, output],
      () => {},
      (text) => {
        stderr += text;
      },
    ),
    1,
  );
  assert.match(stderr, /Line 2:/);
  await assert.rejects(access(output));
  await writeFile(input, "2.12,3.00");
  await writeFile(output, "existing result");
  assert.equal(
    await runCli(
      [input, output],
      () => {},
      () => {},
    ),
    1,
  );
  assert.equal(await readFile(output, "utf8"), "existing result");
  assert.equal(
    await runCli(
      [input, input],
      () => {},
      () => {},
    ),
    1,
  );
  assert.equal(await readFile(input, "utf8"), "2.12,3.00");
});

test("CLI handles help, missing files, invalid UTF-8, empty files and the size limit", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "register-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, "in"),
    output = join(dir, "out");
  let stdout = "";
  assert.equal(
    await runCli(["--help"], (text) => {
      stdout += text;
    }),
    0,
  );
  assert.match(stdout, /Usage:/);
  assert.equal(await runCli(["-h"], () => {}), 0);
  assert.equal(
    await runCli(
      [input, output],
      () => {},
      () => {},
    ),
    1,
  );
  await writeFile(input, Buffer.from([0xff, 0xfe]));
  assert.equal(
    await runCli(
      [input, output],
      () => {},
      () => {},
    ),
    1,
  );
  await writeFile(input, "x".repeat(MAX_INPUT_BYTES + 1));
  let stderr = "";
  assert.equal(
    await runCli(
      [input, output],
      () => {},
      (text) => {
        stderr += text;
      },
    ),
    1,
  );
  assert.match(stderr, /1 MiB/);
  await writeFile(input, "");
  assert.equal(await runCli([input, output]), 0);
  assert.equal(await readFile(output, "utf8"), "");
});

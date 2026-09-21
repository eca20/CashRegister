import { test } from "node:test";
import assert from "node:assert/strict";
import { createSanitizer, readableTranscript } from "./sanitize-transcript.mjs";

test("redacts contact details, local paths, credentials and nested JSON while retaining project-relative evidence", () => {
  const { sanitize } = createSanitizer({
    projectRoot: "/Users/tester/work/Register",
    literals: [{ value: "Recruiter Example", category: "contact name" }],
  });
  const output = sanitize({
    "/Users/tester/work/Register/src/money.ts":
      "Check 2.12,3.00 and 44 passing tests.",
    contact: "Recruiter Example <person\\@example.com> +1 (212) 555-0199",
    command:
      "/Users/tester/private/token /private/tmp/check http://127.0.0.1:3180/",
    nested: JSON.stringify({
      path: "/Users/tester/.config/settings",
      credential: "gho_FAKEonlyForThisUnitTest12345",
    }),
  });
  const text = JSON.stringify(output);
  for (const secret of [
    "Recruiter Example",
    "person",
    "example.com",
    "555-0199",
    "/Users/",
    "/private/tmp",
    "127.0.0.1",
    "gho_FAKE",
  ])
    assert.ok(!text.includes(secret), secret);
  assert.equal(
    output["[PROJECT_ROOT]/src/money.ts"],
    "Check 2.12,3.00 and 44 passing tests.",
  );
  assert.ok(JSON.parse(output.nested).path.includes("REDACTED"));
});

test("retains event order and visible messages while replacing internal state in every representation", () => {
  const { sanitize } = createSanitizer();
  assert.match(
    sanitize({
      replacement_history: [{ content: "internal compaction state" }],
    }).replacement_history,
    /REDACTED/,
  );
  const events = [
    {
      type: "response_item",
      timestamp: "2026-09-21",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Please test the CLI." }],
      },
    },
    {
      type: "response_item",
      payload: {
        type: "reasoning",
        encrypted_content: "private-state",
        summary: ["private-summary"],
      },
    },
    {
      type: "event_msg",
      payload: {
        item: {
          type: "Reasoning",
          raw_content: ["hidden"],
          summary_text: ["hidden"],
        },
      },
    },
    {
      type: "response_item",
      payload: {
        type: "message",
        role: "developer",
        content: [{ text: "internal-config" }],
      },
    },
    { type: "world_state", payload: { state: { host: "private-host" } } },
    {
      type: "response_item",
      timestamp: "2026-09-21",
      payload: { type: "custom_tool_call_output", output: "44 tests passed" },
    },
  ].map(sanitize);
  assert.equal(events.length, 6);
  assert.equal(events[0].payload.content[0].text, "Please test the CLI.");
  assert.equal(events[5].payload.output, "44 tests passed");
  const output = JSON.stringify(events);
  for (const secret of [
    "private-state",
    "private-summary",
    "hidden",
    "internal-config",
    "private-host",
  ])
    assert.ok(!output.includes(secret));
  const readable = readableTranscript(events, "2026-09-21");
  assert.ok(readable.includes("Please test the CLI."));
  assert.ok(readable.includes("44 tests passed"));
});

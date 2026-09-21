import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, resolve, join } from "node:path";

const [source, destination = ".submission-private/transcripts"] =
  process.argv.slice(2);
if (!source)
  throw new Error(
    "Usage: node scripts/export-transcript.mjs <native-session.jsonl> [output-directory]",
  );
const bytes = await readFile(source);
if (bytes.length === 0 || bytes.at(-1) !== 10)
  throw new Error(
    "Empty source or incomplete final record; retry after the writer flushes.",
  );
const events = bytes
  .toString("utf8")
  .trimEnd()
  .split("\n")
  .map((line) => JSON.parse(line));
const meta = events.find((event) => event.type === "session_meta")?.payload;
if (!meta?.id)
  throw new Error("Expected a native Codex session with session_meta.");
const timestamp = new Date().toISOString();
const directory = resolve(destination, timestamp.replace(/[:.]/g, "-"));
await mkdir(directory, { recursive: true });
await writeFile(join(directory, "native-session.jsonl"), bytes, {
  flag: "wx",
  mode: 0o600,
});
const manifest = {
  sessionId: meta.id,
  sourceFile: basename(source),
  exportedAt: timestamp,
  lastRecordedEventAt: events.at(-1)?.timestamp,
  eventCount: events.length,
  byteCount: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  rawFile: "native-session.jsonl",
  models: [
    ...new Set(
      events
        .filter((event) => event.type === "turn_context")
        .map((event) => event.payload.model),
    ),
  ],
  note: "Exact native bytes through stated cutoff. Later conversation not included. No redaction or reconstruction.",
};
await writeFile(
  join(directory, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  { flag: "wx", mode: 0o600 },
);
const readable = [
  "# Conversation export (derived)",
  "",
  `Exported: ${timestamp}`,
  "",
  "Native JSONL is authoritative. This view includes recorded user/assistant messages and tool calls/results; internal metadata and encrypted reasoning are omitted.",
  "",
];
for (const event of events) {
  if (event.type !== "response_item") continue;
  const item = event.payload;
  if (item.type === "message" && ["user", "assistant"].includes(item.role)) {
    readable.push(`## ${item.role} — ${event.timestamp}`, "");
    for (const part of item.content ?? [])
      if (typeof part.text === "string") readable.push(part.text, "");
  } else if (
    [
      "function_call",
      "custom_tool_call",
      "function_call_output",
      "custom_tool_call_output",
    ].includes(item.type)
  ) {
    readable.push(
      `## ${item.type}${item.name ? `: ${item.name}` : ""} — ${event.timestamp}`,
      "",
      "~~~~text",
      typeof item.output === "string"
        ? item.output
        : typeof item.input === "string"
          ? item.input
          : typeof item.arguments === "string"
            ? item.arguments
            : JSON.stringify(item),
      "~~~~",
      "",
    );
  }
}
await writeFile(join(directory, "conversation.md"), readable.join("\n"), {
  flag: "wx",
  mode: 0o600,
});
console.log(JSON.stringify({ directory, ...manifest }, null, 2));

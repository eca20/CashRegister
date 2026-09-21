import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

// Exact identifying strings belong in an ignored, local configuration file.
// Generic rules also cover encoded/nested tool output and object keys.
export function createSanitizer({ projectRoot, literals = [] } = {}) {
  const counts = {};
  const identifiers = new Map();
  function mark(category) {
    counts[category] = (counts[category] ?? 0) + 1;
    return `[REDACTED: ${category}]`;
  }
  function opaque(value, category) {
    const key = `${category}:${value}`;
    const marker = mark(category);
    if (!identifiers.has(key))
      identifiers.set(key, `${marker.slice(0, -1)} ${identifiers.size + 1}]`);
    return identifiers.get(key);
  }
  function text(value) {
    // Tool arguments/results are often a JSON document encoded inside a string.
    if (/^\s*[\[{]/.test(value)) {
      try {
        return JSON.stringify(walk(JSON.parse(value)));
      } catch {
        /* plain text */
      }
    }
    let result = value;
    for (const tag of [
      "environment_context",
      "in-app-browser-context",
      "app-context",
      "recommended_plugins",
      "skills_instructions",
      "permissions instructions",
    ]) {
      result = result.replace(
        new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, "g"),
        () => mark("local environment context"),
      );
    }
    result = result.replace(
      /[A-Z0-9._%+-]+(?:\\+)?(?:@|&#64;|&commat;)[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      () => mark("email"),
    );
    result = result.replace(
      /(?<!\w)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}(?!\w)/g,
      () => mark("phone"),
    );
    result = result.replace(
      /(?<![\w.])(?:\+1)?[2-9]\d{2}[2-9]\d{6}(?![\w.])/g,
      () => mark("phone"),
    );
    result = result.replace(
      /\b(?:gh[pousr]_[A-Za-z0-9_*]{6,}|github_pat_[A-Za-z0-9_*]{6,}|sk-(?:proj-)?[A-Za-z0-9_*\-]{20,}|AKIA[A-Z0-9]{16})(?![A-Za-z0-9_*])/g,
      () => mark("credential"),
    );
    result = result.replace(
      /(Authorization\s*[:=]\s*["']?(?:Bearer|token)\s+)[^\s"'\\]+/gi,
      (_match, prefix) => `${prefix}${mark("credential")}`,
    );
    if (projectRoot)
      result = result.replaceAll(projectRoot, () => {
        mark("project location");
        return "[PROJECT_ROOT]";
      });
    result = result.replace(
      /(?<!\w)\/(?:Users|home|private|tmp|var|opt|usr|Applications|Volumes|Library|etc)\/[^\s"'`<>\\]*/g,
      (value) => opaque(value, "local path"),
    );
    result = result.replace(
      /[A-Z]:\\(?:Users|Windows|Temp)\\[^\s"'`<>]*/gi,
      (value) => opaque(value, "local path"),
    );
    result = result.replace(
      /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?/g,
      () => mark("local endpoint"),
    );
    result = result.replace(
      /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g,
      () => mark("private IP"),
    );
    result = result.replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      (value) => opaque(value, "local identifier"),
    );
    result = result.replace(/data:(?:image|audio|video)\/[^\s"']+/g, () =>
      mark("embedded media"),
    );
    for (const { value: literal, category } of literals) {
      if (literal) result = result.replaceAll(literal, () => mark(category));
    }
    return result;
  }
  const internalKeys = new Set([
    "base_instructions",
    "internal_chat_message_metadata_passthrough",
    "guardian_history",
    "replacement_history",
    "retained_context",
    "encrypted_content",
  ]);
  function walk(value, key = "") {
    if (internalKeys.has(key))
      return value == null ? value : mark("internal tool/model state");
    if (key === "process_id")
      return value == null ? value : mark("local process ID");
    if (typeof value === "string") return text(value);
    if (Array.isArray(value)) return value.map((part) => walk(part));
    if (!value || typeof value !== "object") return value;
    const type = String(value.type ?? "").toLowerCase();
    if (
      type === "reasoning" ||
      value.phase === "analysis" ||
      value.channel === "analysis"
    ) {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          k,
          ["type", "id", "phase", "channel"].includes(k)
            ? walk(v, k)
            : mark("internal model data"),
        ]),
      );
    }
    if (type === "message" && ["system", "developer"].includes(value.role)) {
      return {
        ...Object.fromEntries(
          Object.entries(value)
            .filter(([k]) => k !== "content")
            .map(([k, v]) => [k, walk(v, k)]),
        ),
        content: [{ type: "text", text: mark("internal tool configuration") }],
      };
    }
    if (["image", "input_image", "audio", "input_audio"].includes(type))
      return { type: value.type, redacted: mark("embedded media") };
    if (type === "world_state")
      return { ...value, payload: mark("local environment configuration") };
    if (type === "turn_context") {
      const keep = new Set([
        "model",
        "effort",
        "current_date",
        "turn_id",
        "root_turn_id",
      ]);
      return {
        ...value,
        payload: Object.fromEntries(
          Object.entries(value.payload).map(([k, v]) => [
            k,
            keep.has(k) ? walk(v, k) : mark("local environment configuration"),
          ]),
        ),
      };
    }
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [text(k), walk(v, k)]),
    );
  }
  return { sanitize: walk, counts };
}

export function readableTranscript(events, cutoff) {
  const lines = [
    "# Conversation transcript — redacted",
    "",
    `Source cutoff: ${cutoff}`,
    "",
    "All recorded user/assistant messages and tool calls/results in the primary response stream are retained below with explicit redaction markers. The companion JSONL retains every native event, including duplicate event representations. Internal model/tool state, contact details, identifying local environment information and embedded media are redacted. Source truncations remain as recorded.",
    "",
  ];
  for (const event of events) {
    if (event.type !== "response_item") continue;
    const item = event.payload;
    if (item.type === "message" && ["user", "assistant"].includes(item.role)) {
      lines.push(`## ${item.role} — ${event.timestamp}`, "");
      for (const part of item.content ?? [])
        if (typeof part.text === "string") lines.push(part.text, "");
    } else if (
      [
        "function_call",
        "custom_tool_call",
        "function_call_output",
        "custom_tool_call_output",
      ].includes(item.type)
    ) {
      const content = item.output ?? item.input ?? item.arguments ?? item;
      const body =
        typeof content === "string" ? content : JSON.stringify(content);
      const fence = "~".repeat(
        Math.max(
          4,
          ...Array.from(body.matchAll(/~+/g), (m) => m[0].length + 1),
        ),
      );
      lines.push(
        `## ${item.type}${item.name ? `: ${item.name}` : ""} — ${event.timestamp}`,
        "",
        `${fence}text`,
        body,
        fence,
        "",
      );
    }
  }
  return lines.join("\n");
}

async function main() {
  const [source, configFile, destination] = process.argv.slice(2);
  if (!source || !configFile || !destination)
    throw new Error(
      "Usage: node scripts/sanitize-transcript.mjs <private-snapshot.jsonl> <private-redaction-config.json> <output-directory>",
    );
  const raw = await readFile(source);
  if (raw.at(-1) !== 10)
    throw new Error("Snapshot must end with a complete record.");
  const events = raw
    .toString("utf8")
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
  const config = JSON.parse(await readFile(configFile, "utf8"));
  const { sanitize, counts } = createSanitizer(config);
  const sanitized = events.map((event) => sanitize(event));
  const jsonl =
    sanitized.map((event) => JSON.stringify(event)).join("\n") + "\n";
  const cutoff = events.at(-1).timestamp;
  const markdown = readableTranscript(sanitized, cutoff);
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const directory = resolve(destination);
  await mkdir(directory, { recursive: true });
  // Scan both artifacts for configured identifiers before writing public files.
  for (const { value } of config.literals ?? []) {
    if (value && (jsonl.includes(value) || markdown.includes(value)))
      throw new Error("A configured identifier survived sanitization.");
  }
  const manifest = {
    exportedAt: new Date().toISOString(),
    sourceCutoff: cutoff,
    sourceSha256: digest(raw),
    sourceByteCount: raw.length,
    sourceEventCount: events.length,
    publishedEventCount: sanitized.length,
    files: {
      "native-session.redacted.jsonl": {
        sha256: digest(jsonl),
        byteCount: Buffer.byteLength(jsonl),
      },
      "conversation.redacted.md": {
        sha256: digest(markdown),
        byteCount: Buffer.byteLength(markdown),
      },
    },
    redactions: counts,
    note: "All native events retained in original order, with explicit value redactions and JSON reserialization. This is not an unmodified raw export. The unmodified source is retained privately. The readable file is a derivative, not a replacement for the redacted native log. Messages after the source cutoff are not included.",
  };
  await writeFile(join(directory, "native-session.redacted.jsonl"), jsonl);
  await writeFile(join(directory, "conversation.redacted.md"), markdown);
  await writeFile(
    join(directory, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(JSON.stringify(manifest, null, 2));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();

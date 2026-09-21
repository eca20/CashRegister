import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { processFile, divisibleBy } from "./register.js";
import { MAX_INPUT_BYTES, MAX_REQUEST_BYTES } from "./limits.js";

const defaultWebRoot = fileURLToPath(
  new URL("../../web-dist/", import.meta.url),
);

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (
    request.headers["content-type"]?.split(";")[0]?.trim() !==
    "application/json"
  ) {
    throw new HttpError(415, "Send application/json.");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const part of request) {
    const chunk = Buffer.from(part as Uint8Array);
    size += chunk.length;
    // Drain oversized bodies, but never buffer beyond the documented cap.
    if (size <= MAX_REQUEST_BYTES) chunks.push(chunk);
  }
  if (size > MAX_REQUEST_BYTES)
    throw new HttpError(413, "Request exceeds the 2 MiB limit.");
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    );
  } catch {
    throw new HttpError(400, "Request must contain valid UTF-8 JSON.");
  }
}

async function calculate(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const value = await readJson(request);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(
      400,
      "Expected an object with input, currency and divisor.",
    );
  }
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some(
      (key) => !["input", "currency", "divisor"].includes(key),
    )
  ) {
    throw new HttpError(400, "Unknown request field.");
  }
  if (typeof body.input !== "string")
    throw new HttpError(400, "Input must be text.");
  if (Buffer.byteLength(body.input, "utf8") > MAX_INPUT_BYTES) {
    throw new HttpError(413, "Input exceeds the 1 MiB limit.");
  }
  const currency = body.currency === undefined ? "USD" : body.currency;
  if (currency !== "USD" && currency !== "EUR")
    throw new HttpError(400, "Currency must be USD or EUR.");
  const divisor = body.divisor === undefined ? 3 : body.divisor;
  if (typeof divisor !== "number")
    throw new HttpError(400, "Divisor must be a positive safe integer.");
  try {
    const output = processFile(body.input, {
      currency,
      rules: [divisibleBy(divisor)],
    });
    json(response, 200, { output });
  } catch (error) {
    throw new HttpError(
      422,
      error instanceof Error ? error.message : "Unable to process input.",
    );
  }
}

export function createAppServer(webRoot = defaultWebRoot) {
  const root = resolve(webRoot);
  const server = createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname === "/api/change") {
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          throw new HttpError(405, "Use POST for /api/change.");
        }
        await calculate(request, response);
        return;
      }
      if (request.method !== "GET")
        throw new HttpError(405, "Use GET for static files.");
      const name =
        url.pathname === "/"
          ? "index.html"
          : decodeURIComponent(url.pathname).slice(1);
      const path = resolve(root, name);
      const types: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
      };
      if (!path.startsWith(`${root}${sep}`) || !types[extname(path)])
        throw new HttpError(404, "Not found.");
      let contents: Buffer;
      try {
        contents = await readFile(path);
      } catch {
        throw new HttpError(404, "Not found.");
      }
      response.writeHead(200, { "Content-Type": types[extname(path)]! });
      response.end(contents);
    } catch (error) {
      if (error instanceof HttpError)
        json(response, error.status, { error: error.message });
      else if (error instanceof URIError)
        json(response, 400, { error: "Invalid URL encoding." });
      else json(response, 500, { error: "Unexpected server error." });
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.setTimeout(10_000, (socket) => socket.destroy());
  return server;
}

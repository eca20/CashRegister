import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  createChangeService,
  DependencyUnavailableError,
  InvalidCalculationError,
} from "./application/change-service.js";
import type { ChangeService } from "./application/change-service.js";
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
  service: ChangeService,
  requestId: string,
  timeoutMs: number,
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
  if (response.destroyed) return;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  response.once("close", cancel);
  const timer = setTimeout(cancel, timeoutMs);
  let abortListener: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    abortListener = () =>
      reject(new HttpError(504, "Calculation timed out or was cancelled."));
    controller.signal.addEventListener("abort", abortListener, { once: true });
  });
  try {
    const result = await Promise.race([
      service.calculate(
        { input: body.input, currency, divisor },
        {
          requestId,
          signal: controller.signal,
        },
      ),
      aborted,
    ]);
    if (!response.destroyed) json(response, 200, result);
  } finally {
    clearTimeout(timer);
    response.off("close", cancel);
    controller.signal.removeEventListener("abort", abortListener);
  }
}

export interface AppServerOptions {
  readonly webRoot?: string;
  readonly serveWeb?: boolean;
  readonly service?: ChangeService;
  readonly requestTimeoutMs?: number;
  readonly isReady?: () => boolean;
}

export function createAppServer(options: AppServerOptions = {}) {
  const root = resolve(options.webRoot ?? defaultWebRoot);
  const service = options.service ?? createChangeService();
  const timeoutMs = options.requestTimeoutMs ?? 10_000;
  const server = createServer(async (request, response) => {
    const suppliedId = request.headers["x-request-id"];
    const requestId =
      typeof suppliedId === "string" &&
      /^[a-zA-Z0-9._-]{1,128}$/.test(suppliedId)
        ? suppliedId
        : randomUUID();
    response.setHeader("X-Request-ID", requestId);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname === "/health/live" || url.pathname === "/health/ready") {
        if (request.method !== "GET") {
          response.setHeader("Allow", "GET");
          throw new HttpError(405, "Use GET for health checks.");
        }
        const ready =
          url.pathname === "/health/live" || (options.isReady?.() ?? true);
        json(response, ready ? 200 : 503, {
          status: ready ? "ok" : "unavailable",
        });
        return;
      }
      if (url.pathname === "/api/change") {
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          throw new HttpError(405, "Use POST for /api/change.");
        }
        if (options.isReady && !options.isReady())
          throw new HttpError(503, "Service is not ready.");
        await calculate(request, response, service, requestId, timeoutMs);
        return;
      }
      if (options.serveWeb === false) throw new HttpError(404, "Not found.");
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
      if (response.destroyed) return;
      if (error instanceof HttpError)
        json(response, error.status, { error: error.message });
      else if (error instanceof InvalidCalculationError)
        json(response, 422, { error: error.message });
      else if (error instanceof DependencyUnavailableError)
        json(response, 503, {
          error: "A required service dependency is unavailable.",
        });
      else if (error instanceof URIError)
        json(response, 400, { error: "Invalid URL encoding." });
      else json(response, 500, { error: "Unexpected server error." });
    }
  });
  server.requestTimeout = timeoutMs;
  server.headersTimeout = timeoutMs;
  return server;
}

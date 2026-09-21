export interface ServiceConfig {
  readonly host: string;
  readonly port: number;
  readonly serveWeb: boolean;
  readonly requestTimeoutMs: number;
  readonly shutdownTimeoutMs: number;
}

export function readConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ServiceConfig {
  function integer(name: string, fallback: number, maximum: number): number {
    const text = env[name] ?? String(fallback);
    const value = Number(text);
    if (
      !/^\d+$/.test(text) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > maximum
    )
      throw new Error(`${name} must be an integer in 1..${maximum}.`);
    return value;
  }
  const host = env.HOST ?? "127.0.0.1";
  if (!host.trim() || host !== host.trim())
    throw new Error(
      "HOST must be a nonempty host without surrounding whitespace.",
    );
  const serveWeb = env.SERVE_WEB ?? "true";
  if (serveWeb !== "true" && serveWeb !== "false")
    throw new Error("SERVE_WEB must be true or false.");
  return Object.freeze({
    host,
    port: integer("PORT", 3000, 65535),
    serveWeb: serveWeb === "true",
    requestTimeoutMs: integer("REQUEST_TIMEOUT_MS", 10_000, 120_000),
    shutdownTimeoutMs: integer("SHUTDOWN_TIMEOUT_MS", 15_000, 120_000),
  });
}

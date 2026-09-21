import { createChangeService } from "./application/change-service.js";
import type { ChangeService } from "./application/change-service.js";
import type { ServiceConfig } from "./config.js";
import { createAppServer } from "./server.js";

export interface RuntimeDependencies {
  readonly service?: ChangeService;
  // Future adapters can expose cached readiness without doing I/O in probes.
  readonly isReady?: () => boolean;
  // Wire pool/client cleanup here when real adapters are introduced.
  readonly dispose?: () => Promise<void>;
}

export function createServiceRuntime(
  config: ServiceConfig,
  dependencies: RuntimeDependencies = {},
) {
  let stopping = false;
  let stopPromise: Promise<void> | undefined;
  const server = createAppServer({
    service: dependencies.service ?? createChangeService(),
    serveWeb: config.serveWeb,
    requestTimeoutMs: config.requestTimeoutMs,
    isReady: () => !stopping && (dependencies.isReady?.() ?? true),
  });

  async function drain(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        server.closeAllConnections();
        reject(new Error("Service shutdown deadline exceeded."));
      }, config.shutdownTimeoutMs);
    });
    const close = async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
      await dependencies.dispose?.();
    };
    try {
      await Promise.race([close(), deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    server,
    stop(): Promise<void> {
      stopping = true;
      stopPromise ??= drain();
      return stopPromise;
    },
  };
}

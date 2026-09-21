import { readConfig } from "./config.js";
import { createServiceRuntime } from "./runtime.js";

// Composition root: construct future adapters here, inject the service and
// register their cleanup with the runtime. Defaults perform no external I/O.
const config = readConfig();
const runtime = createServiceRuntime(config);
runtime.server.listen(config.port, config.host, () => {
  console.log(`Cash Register: http://${config.host}:${config.port}`);
});
let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    void runtime.stop().catch(() => {
      console.error("Unable to finish service shutdown within its deadline.");
      process.exit(1);
    });
  });
}

import { createAppServer } from "./server.js";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be 1..65535.");
const host = process.env.HOST ?? "127.0.0.1";
const server = createAppServer();
server.listen(port, host, () => {
  console.log(`Cash Register: http://${host}:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
  });
}

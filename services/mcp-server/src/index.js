import "dotenv/config";

import { config } from "./config.js";
import { createMcpServer } from "./server.js";

const app = createMcpServer();
const server = app.listen(config.port, config.host, () => {
  console.log(
    `[mcp-server] MCP Streamable HTTP listening on ${config.host}:${config.port}/mcp`
  );
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[mcp-server] ${signal} received, shutting down`);

  const timeout = setTimeout(() => {
    console.error("[mcp-server] graceful shutdown timed out");
    server.closeAllConnections?.();
  }, 5_000);
  timeout.unref();

  await new Promise((resolve) => server.close(resolve));
  clearTimeout(timeout);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shutdown(signal)
      .then(() => {
        process.exitCode = 0;
      })
      .catch((error) => {
        console.error("[mcp-server] shutdown failed", error);
        process.exitCode = 1;
      });
  });
}

import "dotenv/config";
import { config } from "./config.js";
import { createMcpServer } from "./server.js";

const server = createMcpServer();

server.listen(config.port, () => {
  console.log(`[mcp-server] MCP HTTP transport listening on ${config.port}/mcp`);
});

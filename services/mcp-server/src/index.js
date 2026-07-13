import "dotenv/config";
import { config } from "./config.js";
import { createMcpServer } from "./server.js";

const server = createMcpServer();

server.listen(config.port, config.host, () => {
  console.log(`[mcp-server] MCP Streamable HTTP listening on ${config.host}:${config.port}/mcp`);
});

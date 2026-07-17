import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { businessDate } from "@bus/shared/date.js";

export async function runMcpDemo(
  {
    baseUrl = process.env.MCP_SERVER_URL || "http://localhost:4010/mcp",
    departureDate = businessDate(new Date(), 1)
  } = {},
  {
    createClient = () =>
      new Client({ name: "bus-booking-demo-client", version: "1.0.0" }),
    createTransport = (url) =>
      new StreamableHTTPClientTransport(new URL(url))
  } = {}
) {
  const client = createClient();
  const transport = createTransport(baseUrl);
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const search = await client.callTool({
      name: "search_trips",
      arguments: {
        origin: "TP.HCM",
        destination: "Da Lat",
        departureDate
      }
    });
    const policy = await client.readResource({
      uri: "bus://policy/cancellation"
    });
    return {
      toolNames: tools.tools.map((tool) => tool.name),
      search,
      cancellationPolicy: policy.contents
    };
  } finally {
    await client.close();
  }
}

const isMain =
  process.argv[1] &&
  new URL(import.meta.url).pathname.endsWith(
    process.argv[1].replaceAll("\\", "/")
  );

if (isMain) {
  runMcpDemo()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(`[mcp-demo] ${error.message}`);
      process.exitCode = 1;
    });
}

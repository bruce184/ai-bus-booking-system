export const config = {
  port: Number.parseInt(process.env.MCP_SERVER_PORT ?? "4010", 10),
  host: process.env.MCP_SERVER_HOST ?? "127.0.0.1",
  allowedHosts: (process.env.MCP_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
  graphqlUrl: process.env.GRAPHQL_GATEWAY_URL ?? "http://localhost:4000/graphql",
  analyticsServiceUrl: process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:50056",
  tripServiceGraphqlUrl: process.env.TRIP_SERVICE_GRAPHQL_URL ?? "",
  bookingServiceGraphqlUrl: process.env.BOOKING_SERVICE_GRAPHQL_URL ?? "",
  adminToken: process.env.MCP_ADMIN_TOKEN ?? ""
};

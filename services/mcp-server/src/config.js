export const config = {
  port: Number.parseInt(process.env.MCP_SERVER_PORT ?? "4010", 10),
  graphqlUrl: process.env.GRAPHQL_GATEWAY_URL ?? "http://localhost:4000/graphql",
  tripServiceGraphqlUrl: process.env.TRIP_SERVICE_GRAPHQL_URL ?? "",
  bookingServiceGraphqlUrl: process.env.BOOKING_SERVICE_GRAPHQL_URL ?? "",
  adminToken: process.env.MCP_ADMIN_TOKEN ?? ""
};

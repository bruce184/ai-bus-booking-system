export const config = {
  port: Number.parseInt(process.env.GRAPHQL_GATEWAY_PORT ?? "4000", 10),
  analyticsServiceUrl: process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:50056",
  tripServiceGraphqlUrl: process.env.TRIP_SERVICE_GRAPHQL_URL ?? "",
  bookingServiceGraphqlUrl: process.env.BOOKING_SERVICE_GRAPHQL_URL ?? ""
};

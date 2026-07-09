import { config } from "./config.js";
import { graphqlRequest } from "./graphqlClient.js";

export const toolDefinitions = [
  {
    name: "search_trips",
    description: "Search public demo trips by origin, destination, and departure date.",
    inputSchema: {
      type: "object",
      required: ["origin", "destination", "departureDate"],
      properties: {
        origin: { type: "string" },
        destination: { type: "string" },
        departureDate: { type: "string" },
        minAvailableSeats: { type: "number" }
      }
    }
  },
  {
    name: "get_trip_detail",
    description: "Get public trip detail by trip id.",
    inputSchema: {
      type: "object",
      required: ["tripId"],
      properties: { tripId: { type: "string" } }
    }
  },
  {
    name: "get_booking_status",
    description: "Lookup booking status. Requires booking code and email.",
    inputSchema: {
      type: "object",
      required: ["bookingCode", "email"],
      properties: {
        bookingCode: { type: "string" },
        email: { type: "string" }
      }
    }
  },
  {
    name: "get_revenue_summary",
    description: "Admin-only revenue summary.",
    inputSchema: {
      type: "object",
      required: ["from", "to", "adminToken"],
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        adminToken: { type: "string" }
      }
    }
  },
  {
    name: "get_popular_routes",
    description: "Get popular public aggregate routes.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } }
    }
  }
];

export async function callTool(name, args = {}) {
  switch (name) {
    case "search_trips":
      requireFields(args, ["origin", "destination", "departureDate"]);
      return queryGraphqlText({
        query:
          "query SearchTrips($input: SearchTripsInput!) { searchTrips(input: $input) { trips { id operatorName vehicleType departureTime arrivalTime price availableSeats } suggestedDates seoTitle cacheHit } }",
        variables: { input: args },
        url: config.tripServiceGraphqlUrl || config.graphqlUrl
      });
    case "get_trip_detail":
      requireFields(args, ["tripId"]);
      return queryGraphqlText({
        query:
          "query Trip($id: ID!) { trip(id: $id) { trip { id operatorName vehicleType departureTime arrivalTime price availableSeats } pickupPoints { name address } dropoffPoints { name address } cancellationPolicy checkinPolicy } }",
        variables: { id: args.tripId },
        url: config.tripServiceGraphqlUrl || config.graphqlUrl
      });
    case "get_booking_status":
      requireFields(args, ["bookingCode", "email"]);
      return queryGraphqlText({
        query:
          "query BookingStatus($bookingCode: String!, $email: String!) { bookingStatus(bookingCode: $bookingCode, email: $email) { bookingCode status contactEmail totalAmount } }",
        variables: { bookingCode: args.bookingCode, email: args.email },
        url: config.bookingServiceGraphqlUrl || config.graphqlUrl
      });
    case "get_revenue_summary":
      requireFields(args, ["from", "to", "adminToken"]);
      if (!config.adminToken || args.adminToken !== config.adminToken) {
        throw Object.assign(new Error("Admin token is required for get_revenue_summary"), {
          code: "FORBIDDEN"
        });
      }
      return jsonText(
        await fetchAnalyticsJson("/admin/revenue-summary", {
          from: args.from,
          to: args.to
        })
      );
    case "get_popular_routes":
      return jsonText(
        await fetchAnalyticsJson("/popular-routes", {
          limit: args.limit ?? 5
        })
      );
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: "NOT_FOUND" });
  }
}

function requireFields(args, fields) {
  const missing = fields.filter((field) => !String(args[field] ?? "").trim());
  if (missing.length) {
    throw Object.assign(new Error(`Missing required field(s): ${missing.join(", ")}`), {
      code: "VALIDATION_ERROR"
    });
  }
}

async function queryGraphqlText(request) {
  const data = await graphqlRequest(request);
  return jsonText(data);
}

async function fetchAnalyticsJson(path, params = {}) {
  const url = new URL(path, config.analyticsServiceUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message ?? "Analytics Service request failed");
    error.code = body.error ?? "INTERNAL_ERROR";
    throw error;
  }
  return body;
}

function jsonText(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

import { fetchWithTimeout } from "@bus/shared/http.js";
import {
  CANCELLATION_POLICY_TEXT,
  CANCELLATION_POLICY_URI,
  CHECKIN_POLICY_TEXT,
  CHECKIN_POLICY_URI
} from "@bus/shared/policies.js";

const GRAPHQL_URL =
  process.env.GRAPHQL_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_GRAPHQL_URL ||
  "http://localhost:4000/graphql";

export const policyResources = {
  cancellation: {
    source: CANCELLATION_POLICY_URI,
    text: CANCELLATION_POLICY_TEXT
  },
  checkin: {
    source: CHECKIN_POLICY_URI,
    text: CHECKIN_POLICY_TEXT
  }
};

export async function executeSearchTrips(input = {}) {
  requireFields(input, ["origin", "destination", "departureDate"]);

  try {
    return await graphqlRequest({
      query:
        "query SearchTrips($input: SearchTripsInput!) { searchTrips(input: $input) { trips { id operatorName departureTime arrivalTime price availableSeats } suggestedDates seoTitle cacheHit } }",
      variables: { input }
    });
  } catch (error) {
    return {
      error: "TRIP_DATA_UNAVAILABLE",
      message: error.message,
      rule: "Do not invent trip inventory. Tell the user the trip service data is unavailable."
    };
  }
}

export async function executeGetBookingStatus(input = {}) {
  requireFields(input, ["bookingCode", "email"]);

  try {
    return await graphqlRequest({
      query:
        "query BookingStatus($bookingCode: String!, $email: String!) { bookingStatus(bookingCode: $bookingCode, email: $email) { bookingCode status contactEmail totalAmount } }",
      variables: {
        bookingCode: input.bookingCode,
        email: input.email
      }
    });
  } catch (error) {
    return {
      error: "BOOKING_DATA_UNAVAILABLE",
      message: error.message,
      rule: "Do not invent booking status. Tell the user the lookup service is unavailable."
    };
  }
}

export function readPolicyResource(policy) {
  const resource = policyResources[policy];
  if (!resource) {
    return {
      error: "POLICY_NOT_FOUND",
      message: "No internal policy resource exists for that policy."
    };
  }

  return resource;
}

function requireFields(input, fields) {
  const missing = fields.filter((field) => !String(input[field] ?? "").trim());
  if (missing.length) {
    const error = new Error(`Missing required field(s): ${missing.join(", ")}`);
    error.code = "VALIDATION_ERROR";
    throw error;
  }
}

async function graphqlRequest({ query, variables }) {
  const response = await fetchWithTimeout(GRAPHQL_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors?.length) {
    throw new Error(body.errors?.[0]?.message ?? `GraphQL request failed with ${response.status}`);
  }

  return body.data;
}

const GRAPHQL_URL =
  process.env.GRAPHQL_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_GRAPHQL_URL ||
  "http://localhost:4000/graphql";

export const policyResources = {
  cancellation: {
    source: "bus://policy/cancellation",
    text:
      "Khach co the huy ve khi booking dang PAID va chuyen xe chua khoi hanh. Phi va dieu kien huy duoc ap dung theo cau hinh demo cua nha xe."
  },
  checkin: {
    source: "bus://policy/checkin",
    text:
      "Hanh khach can co mat truoc gio khoi hanh 30 phut va cung cap ma dat cho, ma ve, hoac QR demo de nhan vien xac nhan."
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
  const response = await fetch(GRAPHQL_URL, {
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

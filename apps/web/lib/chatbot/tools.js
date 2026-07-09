import { tool } from "ai";
import { z } from "zod";
import { graphqlRequest } from "../graphqlClient";

export const chatbotTools = {
  searchTrips: tool({
    description:
      "Search real demo trip inventory through the GraphQL Gateway. Use this for natural language trip questions.",
    inputSchema: z.object({
      origin: z.string(),
      destination: z.string(),
      departureDate: z
        .string()
        .describe("Departure date in YYYY-MM-DD. Ask the user if the date is unclear.")
    }),
    execute: executeSearchTrips
  }),
  getBookingStatus: tool({
    description: "Lookup booking status. Requires booking code and email.",
    inputSchema: z.object({
      bookingCode: z.string(),
      email: z.string().email()
    }),
    execute: executeGetBookingStatus
  }),
  getPolicyResource: tool({
    description:
      "Read an internal policy resource. Use this for cancellation, refund, exchange, or check-in policy questions and cite the returned source.",
    inputSchema: z.object({
      policy: z.enum(["cancellation", "checkin"])
    }),
    execute: executeGetPolicyResource
  })
};

export async function executeSearchTrips(input) {
  try {
    return await graphqlRequest({
      query:
        "query SearchTrips($input: SearchTripsInput!) { searchTrips(input: $input) { trips { id operatorName departureTime price availableSeats } suggestedDates seoTitle cacheHit } }",
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

export async function executeGetBookingStatus({ bookingCode, email }) {
  if (!bookingCode || !email) {
    return {
      error: "BOOKING_LOOKUP_REQUIRES_CODE_AND_EMAIL",
      message: "Booking status lookup requires both booking code and email."
    };
  }

  try {
    return await graphqlRequest({
      query:
        "query BookingStatus($bookingCode: String!, $email: String!) { bookingStatus(bookingCode: $bookingCode, email: $email) { bookingCode status contactEmail totalAmount } }",
      variables: { bookingCode, email }
    });
  } catch (error) {
    return {
      error: "BOOKING_DATA_UNAVAILABLE",
      message: error.message,
      rule: "Do not invent booking status. Tell the user the lookup service is unavailable."
    };
  }
}

export async function executeGetPolicyResource({ policy }) {
  const resource = policyResources[policy];
  if (!resource) {
    return {
      error: "POLICY_NOT_FOUND",
      message: "No internal policy resource exists for that policy."
    };
  }

  return resource;
}

export const policyResources = {
  cancellation: {
    source: "Theo chinh sach huy ve noi bo",
    text:
      "Khach co the huy ve khi booking dang PAID va chuyen xe chua khoi hanh. Phi va dieu kien huy duoc ap dung theo cau hinh demo cua nha xe."
  },
  checkin: {
    source: "Theo chinh sach check-in noi bo",
    text:
      "Hanh khach can co mat truoc gio khoi hanh 30 phut va cung cap ma dat cho, ma ve, hoac QR demo de nhan vien xac nhan."
  }
};

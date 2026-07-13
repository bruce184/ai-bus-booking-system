import { businessDate } from "../date.js";

const SEARCH_TRIPS = `
  query SearchTrips($input: SearchTripsInput!) {
    searchTrips(input: $input) {
      trips {
        id
        operatorName
        vehicleType
        departureTime
        arrivalTime
        durationMinutes
        price
        availableSeats
        route {
          origin { name }
          destination { name }
        }
      }
      suggestedDates
      seoTitle
      cacheHit
    }
  }
`;

const DEFAULT_GRAPHQL_ENDPOINT =
  process.env.GRAPHQL_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_GRAPHQL_URL ||
  "http://localhost:4000/graphql";

export function resolveSearchInput(params, now = new Date()) {
  return {
    origin: params.from || "TP.HCM",
    destination: params.to || "Da Lat",
    departureDate: params.date || businessDate(now, 1)
  };
}

export function buildSearchMetadata(input) {
  return {
    title: `Vé xe ${input.origin} đi ${input.destination} | EcoBus AI`,
    description: `Tìm và đặt vé xe khách từ ${input.origin} đi ${input.destination} ngày ${input.departureDate}.`
  };
}

export async function fetchSearchTrips(
  input,
  { fetchImpl = fetch, endpoint = DEFAULT_GRAPHQL_ENDPOINT } = {}
) {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: SEARCH_TRIPS,
      variables: {
        input: {
          ...input,
          sortBy: "earliest",
          minPrice: 0,
          maxPrice: 0
        }
      }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`GraphQL gateway returned HTTP ${response.status}`);
  }

  const result = await response.json();
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message || "Search query failed");
  }

  return result.data?.searchTrips || null;
}

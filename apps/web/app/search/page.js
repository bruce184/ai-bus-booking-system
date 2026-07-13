import SearchClient from "./_SearchClient";
import { businessDate } from "../../lib/date";

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

const SERVER_GRAPHQL_ENDPOINT =
  process.env.GRAPHQL_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_GRAPHQL_URL ||
  "http://localhost:4000/graphql";

function defaultSearchDate() {
  return businessDate(new Date(), 1);
}

async function fetchSearchTrips({ origin, destination, departureDate }) {
  const response = await fetch(SERVER_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: SEARCH_TRIPS,
      variables: { input: { origin, destination, departureDate, sortBy: "earliest", minPrice: 0, maxPrice: 0 } }
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

function resolveSearchInput(params) {
  return {
    origin: params.from || "TP.HCM",
    destination: params.to || "Da Lat",
    departureDate: params.date || defaultSearchDate()
  };
}

export async function generateMetadata({ searchParams }) {
  const input = resolveSearchInput(await searchParams);

  try {
    const result = await fetchSearchTrips(input);
    if (result?.seoTitle) {
      return {
        title: result.seoTitle,
        description: `Tìm và đặt vé xe khách từ ${input.origin} đi ${input.destination} ngày ${input.departureDate}.`
      };
    }
  } catch (err) {
    console.error("Failed to fetch search metadata:", err);
  }

  return { title: `Vé xe ${input.origin} đi ${input.destination} | EcoBus AI` };
}

export default async function SearchPage({ searchParams }) {
  const input = resolveSearchInput(await searchParams);
  let initialResult = null;

  try {
    initialResult = await fetchSearchTrips(input);
  } catch (err) {
    console.error("Failed to fetch initial search results:", err);
  }

  return (
    <SearchClient
      initialOrigin={input.origin}
      initialDestination={input.destination}
      initialDepartureDate={input.departureDate}
      initialResult={initialResult}
    />
  );
}

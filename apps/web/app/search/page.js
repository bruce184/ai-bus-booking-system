import SearchClient from "./_SearchClient";
import {
  buildSearchMetadata,
  fetchSearchTrips,
  resolveSearchInput,
} from "../../lib/server/search";

export async function generateMetadata({ searchParams }) {
  const input = resolveSearchInput(await searchParams);
  return buildSearchMetadata(input);
}

export default async function SearchPage({ searchParams }) {
  const input = resolveSearchInput(await searchParams);
  let initialResult = null;
  let initialError = "";

  try {
    initialResult = await fetchSearchTrips(input);
  } catch (error) {
    console.error("Failed to fetch initial search results:", error);
    initialError = "Không thể tải kết quả tìm kiếm. Vui lòng thử lại.";
  }

  return (
    <SearchClient
      key={`${input.origin}:${input.destination}:${input.departureDate}`}
      initialOrigin={input.origin}
      initialDestination={input.destination}
      initialDepartureDate={input.departureDate}
      initialResult={initialResult}
      initialError={initialError}
    />
  );
}

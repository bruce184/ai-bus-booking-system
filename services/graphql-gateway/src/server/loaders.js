import DataLoader from "dataloader";
import { callGrpc } from "../grpc/call.js";

// Per-request DataLoaders (Week 1 slide 24/25): batches N individual trip
// lookups issued while resolving a single response - e.g. Booking.trip
// across myBookings/adminBookings - into one GetTripsByIds round-trip
// instead of N GetTripDetail calls. Must be created fresh per request; a
// module-level instance would cache/leak data across unrelated requests.
export function createLoaders(grpc) {
  const tripLoader = new DataLoader(async (tripIds) => {
    const response = await callGrpc(grpc.trip, "getTripsByIds", { tripIds: [...tripIds] });
    const byId = new Map((response.trips || []).map((trip) => [trip.id, trip]));
    return tripIds.map((id) => byId.get(id) ?? new Error(`Trip ${id} not found`));
  });

  return { tripLoader };
}

import { createInsecureClient, loadProto } from "./grpc-client.js";

let tripClient;
const TRIP_SERVICE_TIMEOUT_MS = 5_000;

export function tripServiceAddress(env = process.env) {
  return env.TRIP_SERVICE_GRPC_ADDRESS || env.TRIP_SERVICE_GRPC_URL || "localhost:50051";
}

function client() {
  if (!tripClient) {
    const proto = loadProto("trip.proto");
    tripClient = createInsecureClient(proto.bus.trip.v1.TripService, tripServiceAddress());
  }
  return tripClient;
}

// Trip Service owns routes/locations (database-per-service - see
// docs/ARCHITECTURE.md section 11); this replaces the direct SQL join
// getRouteLabelForTrip used to run into trips/routes/locations.
export async function getTripRouteLabel(tripId) {
  const response = await new Promise((resolve, reject) => {
    client().GetTripDetail(
      { trip_id: tripId },
      { deadline: Date.now() + TRIP_SERVICE_TIMEOUT_MS },
      (error, value) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(value);
      }
    );
  });

  const route = response.trip?.route;
  if (!route?.origin?.name || !route?.destination?.name) {
    return null;
  }
  return `${route.origin.name} -> ${route.destination.name}`;
}

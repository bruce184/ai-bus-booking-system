import { fail } from "@bus/shared/errors.js";
import { createInsecureClient, grpc, loadProto } from "@bus/shared/grpc.js";

let tripClient;
const TRIP_SERVICE_TIMEOUT_MS = 10_000;

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

export function mapTripSnapshot(response) {
  const trip = response.trip;
  return {
    price: trip.price,
    status: trip.status,
    departureTime: trip.departure_time
  };
}

// bookings.trip_id no longer has a physical FK into Trip Service's table
// (database-per-service - see docs/ARCHITECTURE.md section 11): trip_id is
// untrusted input straight from the web client, so its existence and current
// price/status have to be verified through Trip Service's own API instead of
// a local join.
export async function fetchTripSnapshot(tripId) {
  let response;
  try {
    response = await new Promise((resolve, reject) => {
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
  } catch (error) {
    if (error.code === grpc.status.NOT_FOUND) {
      fail("NOT_FOUND", "Trip not found");
    }
    fail("INTERNAL_ERROR", "Trip Service is unavailable");
  }

  return mapTripSnapshot(response);
}

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

export function mapTripServiceError(error) {
  if (error.code === grpc.status.NOT_FOUND) {
    return { code: "NOT_FOUND", message: "Trip not found" };
  }
  if (error.code === grpc.status.DEADLINE_EXCEEDED) {
    return { code: "SERVICE_TIMEOUT", message: "Trip Service timed out" };
  }
  return { code: "INTERNAL_ERROR", message: "Trip Service is unavailable" };
}

function getTripDetail(tripId) {
  return new Promise((resolve, reject) => {
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
}

// bookings.trip_id no longer has a physical FK into Trip Service's table
// (database-per-service - see docs/ARCHITECTURE.md section 11): trip_id is
// untrusted input straight from the web client, so its existence and current
// price/status have to be verified through Trip Service's own API instead of
// a local join.
export async function fetchTripSnapshot(tripId) {
  let response;
  try {
    response = await getTripDetail(tripId);
  } catch (error) {
    const serviceError = mapTripServiceError(error);
    fail(serviceError.code, serviceError.message);
  }

  return mapTripSnapshot(response);
}

// Ticket rendering (fetchBookingById in repository.js) needs route/pickup/
// dropoff/vehicle display text; same database-per-service rule applies, so
// this reads it from Trip Service's GetTripDetail instead of a local join.
// Unlike fetchTripSnapshot, a Trip Service hiccup here must not break reading
// an already-existing booking, so failures fall back to blank display text
// rather than throwing (matches analytics-service's getRouteLabelForTrip).
export function mapTripPresentation(response) {
  const trip = response.trip;
  const origin = trip.route?.origin?.name || "";
  const destination = trip.route?.destination?.name || "";
  const pickupPoint = response.pickup_points?.[0]?.name || origin;
  const dropoffPoint = response.dropoff_points?.[0]?.name || destination;
  return {
    routeLabel: origin && destination ? `${origin} -> ${destination}` : "",
    pickupPoint,
    dropoffPoint,
    departureTime: trip.departure_time || "",
    vehicleCode: trip.vehicle?.vehicle_code || trip.vehicle?.license_plate || ""
  };
}

export async function fetchTripPresentation(tripId) {
  try {
    return mapTripPresentation(await getTripDetail(tripId));
  } catch (error) {
    return { routeLabel: "", pickupPoint: "", dropoffPoint: "", departureTime: "", vehicleCode: "" };
  }
}

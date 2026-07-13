import { createInsecureClient, grpc, loadProto } from "@bus/shared/grpc.js";

import { config } from "./config.js";
import { serviceError } from "./errors.js";

let tripClient;

function client() {
  if (!tripClient) {
    const proto = loadProto("trip.proto");
    tripClient = createInsecureClient(
      proto.bus.trip.v1.TripService,
      config.tripServiceAddress
    );
  }
  return tripClient;
}

export function mapTripServiceError(error) {
  if (error?.code === grpc.status.NOT_FOUND) {
    return serviceError(grpc.status.NOT_FOUND, "Trip not found");
  }
  if (error?.code === grpc.status.DEADLINE_EXCEEDED) {
    return serviceError(grpc.status.DEADLINE_EXCEEDED, "Trip Service timed out");
  }
  return serviceError(grpc.status.UNAVAILABLE, "Trip Service is unavailable");
}

export async function fetchTripStatus(tripId) {
  let response;
  try {
    response = await new Promise((resolve, reject) => {
      client().GetTripDetail(
        { trip_id: tripId },
        { deadline: Date.now() + config.grpcCallTimeoutMs },
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
    throw mapTripServiceError(error);
  }

  const status = response?.trip?.status;
  if (!status) {
    throw serviceError(
      grpc.status.INTERNAL,
      "Trip Service returned an invalid trip status"
    );
  }
  return status;
}

export function closeTripClient() {
  tripClient?.close();
  tripClient = undefined;
}

import { correlationMetadata, createInsecureClient, grpc, loadProto } from "@bus/shared/grpc.js";
import { getCorrelationId } from "@bus/shared/correlation.js";
import { ServiceError } from "@bus/shared/errors.js";

import { config } from "./config.js";
import { fail } from "./errors.js";

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
    return new ServiceError("NOT_FOUND", "Trip not found");
  }
  if (error?.code === grpc.status.DEADLINE_EXCEEDED) {
    return new ServiceError("SERVICE_TIMEOUT", "Trip Service timed out");
  }
  return new ServiceError("SERVICE_UNAVAILABLE", "Trip Service is unavailable");
}

export async function fetchTripStatus(tripId) {
  let response;
  try {
    response = await new Promise((resolve, reject) => {
      const callback = (error, value) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(value);
      };
      const options = { deadline: Date.now() + config.grpcCallTimeoutMs };

      if (getCorrelationId()) {
        client().GetTripDetail({ trip_id: tripId }, correlationMetadata(), options, callback);
      } else {
        client().GetTripDetail({ trip_id: tripId }, options, callback);
      }
    });
  } catch (error) {
    throw mapTripServiceError(error);
  }

  const status = response?.trip?.status;
  if (!status) {
    fail("INTERNAL_ERROR", "Trip Service returned an invalid trip status");
  }
  return status;
}

export function closeTripClient() {
  tripClient?.close();
  tripClient = undefined;
}

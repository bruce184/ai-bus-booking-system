import { toGrpcError } from "@bus/shared/errors.js";
import { readCorrelationId } from "@bus/shared/grpc.js";
import { runWithCorrelationId } from "@bus/shared/correlation.js";
import {
  blockSeats,
  confirmSeats,
  getSeatMap,
  holdSeats,
  releaseBookedSeats,
  releaseHold,
  validateHold
} from "../services/seatMapService.js";

// Single conversion point (matches booking-service's src/index.js `handle`):
// every thrown ServiceError becomes a proper gRPC error via toGrpcError, and
// anything else becomes a generic INTERNAL instead of crashing the server.
function handle(work) {
  return async (call, callback) => {
    try {
      const result = await runWithCorrelationId(readCorrelationId(call), () => work(call.request));
      callback(null, result);
    } catch (error) {
      callback(toGrpcError(error));
    }
  };
}

export const seatInventoryHandlers = {
  getSeatMap: handle(getSeatMap),
  holdSeats: handle(holdSeats),
  releaseHold: handle(releaseHold),
  validateHold: handle(validateHold),
  confirmSeats: handle(confirmSeats),
  releaseBookedSeats: handle(releaseBookedSeats),
  blockSeats: handle(blockSeats)
};

import grpc from "@grpc/grpc-js";
import { notImplemented, serviceError } from "../errors.js";
import {
  blockSeats,
  confirmSeats,
  getSeatMap,
  holdSeats,
  releaseHold
} from "../services/seatMapService.js";

const handleGetSeatMap = async (call, callback) => {
  try {
    callback(null, await getSeatMap(call.request));
  } catch (error) {
    if (error && "code" in error) {
      callback(error);
      return;
    }

    callback(serviceError(grpc.status.INTERNAL, "Failed to get seat map"));
  }
};

const handleHoldSeats = async (call, callback) => {
  try {
    callback(null, await holdSeats(call.request));
  } catch (error) {
    if (error && "code" in error) {
      callback(error);
      return;
    }

    callback(serviceError(grpc.status.INTERNAL, "Failed to hold seats"));
  }
};

const handleReleaseHold = async (call, callback) => {
  try {
    callback(null, await releaseHold(call.request));
  } catch (error) {
    if (error && "code" in error) {
      callback(error);
      return;
    }

    callback(serviceError(grpc.status.INTERNAL, "Failed to release hold"));
  }
};

const handleConfirmSeats = async (call, callback) => {
  try {
    callback(null, await confirmSeats(call.request));
  } catch (error) {
    if (error && "code" in error) {
      callback(error);
      return;
    }

    callback(serviceError(grpc.status.INTERNAL, "Failed to confirm seats"));
  }
};

const handleBlockSeats = async (call, callback) => {
  try {
    callback(null, await blockSeats(call.request));
  } catch (error) {
    if (error && "code" in error) {
      callback(error);
      return;
    }

    callback(serviceError(grpc.status.INTERNAL, "Failed to block seats"));
  }
};

export const seatInventoryHandlers = {
  getSeatMap: handleGetSeatMap,
  holdSeats: handleHoldSeats,
  releaseHold: handleReleaseHold,
  confirmSeats: handleConfirmSeats,
  blockSeats: handleBlockSeats
};

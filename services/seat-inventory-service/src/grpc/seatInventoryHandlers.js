import grpc from "@grpc/grpc-js";
import { notImplemented, serviceError } from "../errors.js";
import {
  blockSeats,
  confirmSeats,
  getSeatMap,
  holdSeats,
  releaseBookedSeats,
  releaseHold,
  validateHold
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

const handleValidateHold = async (call, callback) => {
  try {
    callback(null, await validateHold(call.request));
  } catch (error) {
    if (error && "code" in error) {
      callback(error);
      return;
    }

    callback(serviceError(grpc.status.INTERNAL, "Failed to validate hold"));
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

const handleReleaseBookedSeats = async (call, callback) => {
  try {
    callback(null, await releaseBookedSeats(call.request));
  } catch (error) {
    if (error && "code" in error) {
      callback(error);
      return;
    }

    callback(serviceError(grpc.status.INTERNAL, "Failed to release booked seats"));
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
  validateHold: handleValidateHold,
  confirmSeats: handleConfirmSeats,
  releaseBookedSeats: handleReleaseBookedSeats,
  blockSeats: handleBlockSeats
};

import grpc from "@grpc/grpc-js";
import { notImplemented, serviceError } from "../errors.js";
import {
  blockSeats,
  confirmSeats,
  getSeatMap,
  holdSeats,
  releaseHold,
  type BlockSeatsRequest,
  type BlockSeatsResponse,
  type ConfirmSeatsRequest,
  type ConfirmSeatsResponse,
  type GetSeatMapRequest,
  type GetSeatMapResponse,
  type HoldSeatsRequest,
  type HoldSeatsResponse,
  type ReleaseHoldRequest,
  type ReleaseHoldResponse
} from "../services/seatMapService.js";

function unaryNotImplemented(
  methodName: string
): grpc.handleUnaryCall<Record<string, unknown>, Record<string, unknown>> {
  return (_call, callback) => {
    callback(notImplemented(methodName));
  };
}

const handleGetSeatMap: grpc.handleUnaryCall<GetSeatMapRequest, GetSeatMapResponse> = async (
  call,
  callback
) => {
  try {
    callback(null, await getSeatMap(call.request));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      callback(error as grpc.ServiceError);
      return;
    }

    callback(serviceError(grpc.status.INTERNAL, "Failed to get seat map"));
  }
};

const handleHoldSeats: grpc.handleUnaryCall<HoldSeatsRequest, HoldSeatsResponse> = async (
  call,
  callback
) => {
  try {
    callback(null, await holdSeats(call.request));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      callback(error as grpc.ServiceError);
      return;
    }

    callback(serviceError(grpc.status.INTERNAL, "Failed to hold seats"));
  }
};

const handleReleaseHold: grpc.handleUnaryCall<ReleaseHoldRequest, ReleaseHoldResponse> = async (
  call,
  callback
) => {
  try {
    callback(null, await releaseHold(call.request));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      callback(error as grpc.ServiceError);
      return;
    }

    callback(serviceError(grpc.status.INTERNAL, "Failed to release hold"));
  }
};

const handleConfirmSeats: grpc.handleUnaryCall<ConfirmSeatsRequest, ConfirmSeatsResponse> = async (
  call,
  callback
) => {
  try {
    callback(null, await confirmSeats(call.request));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      callback(error as grpc.ServiceError);
      return;
    }

    callback(serviceError(grpc.status.INTERNAL, "Failed to confirm seats"));
  }
};

const handleBlockSeats: grpc.handleUnaryCall<BlockSeatsRequest, BlockSeatsResponse> = async (
  call,
  callback
) => {
  try {
    callback(null, await blockSeats(call.request));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      callback(error as grpc.ServiceError);
      return;
    }

    callback(serviceError(grpc.status.INTERNAL, "Failed to block seats"));
  }
};

export const seatInventoryHandlers: grpc.UntypedServiceImplementation = {
  getSeatMap: handleGetSeatMap,
  holdSeats: handleHoldSeats,
  releaseHold: handleReleaseHold,
  confirmSeats: handleConfirmSeats,
  blockSeats: handleBlockSeats
};

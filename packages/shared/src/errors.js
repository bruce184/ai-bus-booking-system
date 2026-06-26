import grpc from "@grpc/grpc-js";

const grpcStatusByCode = {
  VALIDATION_ERROR: grpc.status.INVALID_ARGUMENT,
  UNAUTHORIZED: grpc.status.UNAUTHENTICATED,
  FORBIDDEN: grpc.status.PERMISSION_DENIED,
  NOT_FOUND: grpc.status.NOT_FOUND,
  SEAT_NOT_AVAILABLE: grpc.status.FAILED_PRECONDITION,
  HOLD_EXPIRED: grpc.status.FAILED_PRECONDITION,
  BOOKING_STATE_INVALID: grpc.status.FAILED_PRECONDITION,
  PAYMENT_FAILED: grpc.status.FAILED_PRECONDITION,
  INTERNAL_ERROR: grpc.status.INTERNAL
};

export class ServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.details = details;
  }
}

export function fail(code, message, details) {
  throw new ServiceError(code, message, details);
}

export function toGrpcError(error) {
  if (error instanceof ServiceError) {
    const grpcError = new Error(error.message);
    grpcError.code = grpcStatusByCode[error.code] || grpc.status.UNKNOWN;
    grpcError.metadata = new grpc.Metadata();
    grpcError.metadata.set("error-code", error.code);
    return grpcError;
  }

  const grpcError = new Error(error.message || "Unexpected service error");
  grpcError.code = grpc.status.INTERNAL;
  return grpcError;
}

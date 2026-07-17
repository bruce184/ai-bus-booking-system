import grpc from "@grpc/grpc-js";

// Single source of truth for every gRPC service's domain-error -> gRPC status
// mapping (trip-service, seat-inventory-service and booking-service all throw
// a ServiceError with one of these string codes instead of each maintaining
// its own error class / status table).
const grpcStatusByCode = {
  VALIDATION_ERROR: grpc.status.INVALID_ARGUMENT,
  UNAUTHORIZED: grpc.status.UNAUTHENTICATED,
  FORBIDDEN: grpc.status.PERMISSION_DENIED,
  NOT_FOUND: grpc.status.NOT_FOUND,
  SEAT_NOT_AVAILABLE: grpc.status.FAILED_PRECONDITION,
  HOLD_EXPIRED: grpc.status.FAILED_PRECONDITION,
  TRIP_NOT_ACTIVE: grpc.status.FAILED_PRECONDITION,
  BOOKING_STATE_INVALID: grpc.status.FAILED_PRECONDITION,
  FAILED_PRECONDITION: grpc.status.FAILED_PRECONDITION,
  PAYMENT_FAILED: grpc.status.FAILED_PRECONDITION,
  SERVICE_TIMEOUT: grpc.status.DEADLINE_EXCEEDED,
  SERVICE_UNAVAILABLE: grpc.status.UNAVAILABLE,
  SEAT_HOLD_ROLLBACK_FAILED: grpc.status.UNAVAILABLE,
  INTERNAL_ERROR: grpc.status.INTERNAL
};

const serviceErrorCodes = new Set(Object.keys(grpcStatusByCode));

export function isServiceErrorCode(value) {
  return typeof value === "string" && serviceErrorCodes.has(value);
}

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

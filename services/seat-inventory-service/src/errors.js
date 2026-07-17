// Maps domain errors to gRPC status codes through the same shared
// ServiceError/fail/toGrpcError trio every gRPC service uses
// (@bus/shared/errors.js), instead of this service's own error-construction
// helper. Call sites pass a string business code (e.g. "SEAT_NOT_AVAILABLE")
// instead of a raw grpc.status number; toGrpcError derives the wire-level
// status at the gRPC handler boundary (see grpc/seatInventoryHandlers.js).
export { fail, ServiceError, toGrpcError } from "@bus/shared/errors.js";

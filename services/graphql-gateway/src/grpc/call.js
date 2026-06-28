import { status as grpcStatus } from "@grpc/grpc-js";
import { gatewayError } from "../auth/errors.js";

const STANDARD_ERROR_CODES = new Set([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "SEAT_NOT_AVAILABLE",
  "HOLD_EXPIRED",
  "BOOKING_STATE_INVALID",
  "PAYMENT_FAILED",
  "INTERNAL_ERROR"
]);

function normalizeErrorCode(value) {
  if (typeof value === "string" && STANDARD_ERROR_CODES.has(value)) {
    return value;
  }

  return null;
}

function readMetadataErrorCode(error) {
  const values = error.metadata?.get?.("error-code") || [];

  for (const value of values) {
    const code = normalizeErrorCode(Buffer.isBuffer(value) ? value.toString("utf8") : value);

    if (code) {
      return code;
    }
  }

  return null;
}

function readPrefixedErrorCode(error) {
  const details = error.details || error.message || "";
  const [prefix] = details.split(":", 1);

  return normalizeErrorCode(prefix);
}

function mapGrpcErrorCode(error) {
  const explicitCode = readMetadataErrorCode(error) || readPrefixedErrorCode(error);

  if (explicitCode) {
    return explicitCode;
  }

  switch (error.code) {
    case grpcStatus.INVALID_ARGUMENT:
      return "VALIDATION_ERROR";
    case grpcStatus.UNAUTHENTICATED:
      return "UNAUTHORIZED";
    case grpcStatus.PERMISSION_DENIED:
      return "FORBIDDEN";
    case grpcStatus.NOT_FOUND:
      return "NOT_FOUND";
    default:
      return "INTERNAL_ERROR";
  }
}

export function callGrpc(client, methodName, request) {
  const method = client[methodName];

  if (typeof method !== "function") {
    throw gatewayError(`gRPC method ${methodName} is not available.`, "INTERNAL_ERROR");
  }

  return new Promise((resolve, reject) => {
    method.call(client, request, (error, response) => {
      if (error) {
        reject(gatewayError(error.details || error.message, mapGrpcErrorCode(error)));
        return;
      }

      resolve(response);
    });
  });
}

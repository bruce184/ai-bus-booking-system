import { status as grpcStatus } from "@grpc/grpc-js";
import { gatewayError } from "../auth/errors.js";

function mapGrpcErrorCode(error) {
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

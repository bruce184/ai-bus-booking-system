import grpc from "@grpc/grpc-js";

export function serviceError(code: grpc.status, details: string): grpc.ServiceError {
  return Object.assign(new Error(details), {
    code,
    details,
    metadata: new grpc.Metadata()
  });
}

export function notImplemented(methodName: string): grpc.ServiceError {
  return serviceError(grpc.status.UNIMPLEMENTED, `${methodName} is not implemented yet`);
}

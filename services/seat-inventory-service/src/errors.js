import grpc from "@grpc/grpc-js";

export function serviceError(code, details) {
  return Object.assign(new Error(details), {
    code,
    details,
    metadata: new grpc.Metadata()
  });
}

export function notImplemented(methodName) {
  return serviceError(grpc.status.UNIMPLEMENTED, `${methodName} is not implemented yet`);
}

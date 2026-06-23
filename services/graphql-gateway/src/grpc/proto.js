import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const LOADER_OPTIONS = {
  defaults: true,
  enums: String,
  keepCase: false,
  longs: String,
  oneofs: true
};

function readNested(root, segments) {
  return segments.reduce((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return current[segment];
  }, root);
}

function isServiceConstructor(value) {
  return typeof value === "function" && "service" in value;
}

export function loadServiceConstructor(protoPath, servicePath) {
  const packageDefinition = protoLoader.loadSync(protoPath, LOADER_OPTIONS);
  const grpcObject = grpc.loadPackageDefinition(packageDefinition);
  const service = readNested(grpcObject, servicePath);

  if (!isServiceConstructor(service)) {
    throw new Error(`Unable to load gRPC service ${servicePath.join(".")} from ${protoPath}.`);
  }

  return service;
}

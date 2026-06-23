import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const LOADER_OPTIONS: protoLoader.Options = {
  defaults: true,
  enums: String,
  keepCase: false,
  longs: String,
  oneofs: true
};

function readNested(root: grpc.GrpcObject, segments: string[]): unknown {
  return segments.reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, root);
}

function isServiceConstructor(value: unknown): value is grpc.ServiceClientConstructor {
  return typeof value === "function" && "service" in value;
}

export function loadServiceConstructor(
  protoPath: string,
  servicePath: string[]
): grpc.ServiceClientConstructor {
  const packageDefinition = protoLoader.loadSync(protoPath, LOADER_OPTIONS);
  const grpcObject = grpc.loadPackageDefinition(packageDefinition);
  const service = readNested(grpcObject, servicePath);

  if (!isServiceConstructor(service)) {
    throw new Error(`Unable to load gRPC service ${servicePath.join(".")} from ${protoPath}.`);
  }

  return service;
}

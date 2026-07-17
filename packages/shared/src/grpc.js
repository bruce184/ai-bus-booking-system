import { fileURLToPath } from "node:url";
import path from "node:path";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { CORRELATION_METADATA_KEY, getCorrelationId } from "./correlation.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

export function protoPath(name) {
  return path.join(repoRoot, "proto", name);
}

export function loadProto(name) {
  const packageDefinition = protoLoader.loadSync(protoPath(name), {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  return grpc.loadPackageDefinition(packageDefinition);
}

export function createInsecureClient(ServiceCtor, address) {
  return new ServiceCtor(address, grpc.credentials.createInsecure());
}

export function promisifyGrpc(client, method, request) {
  return new Promise((resolve, reject) => {
    client[method](request, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

// Client side: attach the current request's correlation id (if any) as gRPC
// metadata on an outbound call.
export function correlationMetadata() {
  const metadata = new grpc.Metadata();
  const correlationId = getCorrelationId();
  if (correlationId) {
    metadata.set(CORRELATION_METADATA_KEY, correlationId);
  }
  return metadata;
}

// Server side: read the correlation id an inbound call carried, if any.
export function readCorrelationId(call) {
  const [value] = call.metadata?.get?.(CORRELATION_METADATA_KEY) || [];
  return value ? String(value) : null;
}

export { grpc };

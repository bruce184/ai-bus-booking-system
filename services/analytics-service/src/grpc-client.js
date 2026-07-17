// Analytics Service keeps its own db/config modules (same as Trip Service)
// instead of pulling in @bus/shared's heavier event/outbox/db modules for two
// client calls, so this mirrors packages/shared/src/grpc.js's
// loadProto/createInsecureClient rather than importing it. It still reuses
// @bus/shared/correlation.js elsewhere (kafka/consumer.js) - that module is a
// dependency-free AsyncLocalStorage wrapper, not part of what this avoids.
import { fileURLToPath } from "node:url";
import path from "node:path";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { CORRELATION_METADATA_KEY, getCorrelationId } from "@bus/shared/correlation.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function loadProto(name) {
  const packageDefinition = protoLoader.loadSync(path.join(repoRoot, "proto", name), {
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

export function correlationMetadata() {
  const metadata = new grpc.Metadata();
  const correlationId = getCorrelationId();
  if (correlationId) {
    metadata.set(CORRELATION_METADATA_KEY, correlationId);
  }
  return metadata;
}

export { grpc };

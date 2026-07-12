// Analytics Service has never depended on @bus/shared (it keeps its own
// db/config modules, same as Trip Service) so this mirrors
// packages/shared/src/grpc.js's loadProto/createInsecureClient instead of
// pulling in the whole shared package for two client calls.
import { fileURLToPath } from "node:url";
import path from "node:path";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

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

export { grpc };

import { fileURLToPath } from "node:url";
import path from "node:path";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

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

export { grpc };

import path from "node:path";
import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const protoPath = path.resolve(currentDir, "../../../../proto/seat_inventory.proto");

const packageDefinition = protoLoader.loadSync(protoPath, {
  defaults: true,
  enums: String,
  keepCase: false,
  longs: String,
  oneofs: true
});

const grpcObject = grpc.loadPackageDefinition(packageDefinition);

export const seatInventoryServiceDefinition =
  grpcObject.bus.seat.v1.SeatInventoryService.service;

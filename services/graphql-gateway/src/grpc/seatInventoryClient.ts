import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const protoPath = path.resolve(currentDir, "../../../../proto/seat_inventory.proto");

type UnaryCallback<TResponse> = (error: grpc.ServiceError | null, response: TResponse) => void;

type SeatInventoryClient = grpc.Client & {
  getSeatMap(request: unknown, callback: UnaryCallback<unknown>): void;
  holdSeats(request: unknown, callback: UnaryCallback<unknown>): void;
  releaseHold(request: unknown, callback: UnaryCallback<unknown>): void;
};

const packageDefinition = protoLoader.loadSync(protoPath, {
  defaults: true,
  enums: String,
  keepCase: false,
  longs: String,
  oneofs: true
});

const loaded = grpc.loadPackageDefinition(packageDefinition) as unknown as {
  bus: {
    seat: {
      v1: {
        SeatInventoryService: new (
          address: string,
          credentials: grpc.ChannelCredentials
        ) => SeatInventoryClient;
      };
    };
  };
};

const client = new loaded.bus.seat.v1.SeatInventoryService(
  config.seatInventoryGrpcUrl,
  grpc.credentials.createInsecure()
);

export function callSeatInventory<TRequest, TResponse>(
  method: "getSeatMap" | "holdSeats" | "releaseHold",
  request: TRequest
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    client[method](request, (error, response) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(response as TResponse);
    });
  });
}

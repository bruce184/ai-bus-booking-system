import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });
dotenv.config();

export const config = {
  seatInventoryGrpcUrl:
    process.env.SEAT_INVENTORY_GRPC_URL ??
    `localhost:${process.env.SEAT_INVENTORY_SERVICE_PORT ?? "50053"}`
};

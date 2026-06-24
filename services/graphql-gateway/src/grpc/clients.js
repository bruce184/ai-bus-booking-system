import * as grpc from "@grpc/grpc-js";
import { getProtoPath } from "../config/paths.js";
import { loadServiceConstructor } from "./proto.js";

export function createGrpcClients(config) {
  const insecureCredentials = grpc.credentials.createInsecure();

  const TripService = loadServiceConstructor(getProtoPath("trip.proto"), [
    "bus",
    "trip",
    "v1",
    "TripService"
  ]);
  const BookingService = loadServiceConstructor(getProtoPath("booking.proto"), [
    "bus",
    "booking",
    "v1",
    "BookingService"
  ]);
  const SeatInventoryService = loadServiceConstructor(getProtoPath("seat_inventory.proto"), [
    "bus",
    "seat",
    "v1",
    "SeatInventoryService"
  ]);

  return {
    trip: new TripService(config.grpc.tripAddress, insecureCredentials),
    booking: new BookingService(config.grpc.bookingAddress, insecureCredentials),
    seatInventory: new SeatInventoryService(config.grpc.seatInventoryAddress, insecureCredentials)
  };
}

export function closeGrpcClients(clients) {
  clients.trip.close();
  clients.booking.close();
  clients.seatInventory.close();
}

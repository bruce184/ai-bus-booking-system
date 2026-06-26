import { createInsecureClient, loadProto, promisifyGrpc } from "@bus/shared/grpc.js";

let bookingClient;

function client() {
  if (!bookingClient) {
    const proto = loadProto("booking.proto");
    bookingClient = createInsecureClient(
      proto.bus.booking.v1.BookingService,
      process.env.BOOKING_GRPC_TARGET || "localhost:50053"
    );
  }
  return bookingClient;
}

export function callBooking(method, request) {
  return promisifyGrpc(client(), method, request);
}

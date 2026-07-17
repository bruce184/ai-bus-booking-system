import { getCorrelationId } from "@bus/shared/correlation.js";
import { correlationMetadata, createInsecureClient, loadProto } from "./grpc-client.js";

let bookingClient;
const BOOKING_SERVICE_TIMEOUT_MS = 5_000;

export function bookingServiceAddress(env = process.env) {
  return env.BOOKING_SERVICE_GRPC_ADDRESS || env.BOOKING_GRPC_URL || "localhost:50053";
}

function client() {
  if (!bookingClient) {
    const proto = loadProto("booking.proto");
    bookingClient = createInsecureClient(proto.bus.booking.v1.BookingService, bookingServiceAddress());
  }
  return bookingClient;
}

// Booking Service owns bookings/booking_passengers/event_logs
// (database-per-service - see docs/ARCHITECTURE.md section 11); this
// replaces the direct SQL join getBookingCancellationMetrics used to run
// into those tables. GetBookingMetrics is an internal RPC, not part of the
// public GraphQL surface.
export async function getBookingMetrics(bookingId) {
  const response = await new Promise((resolve, reject) => {
    const callback = (error, value) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(value);
    };
    const options = { deadline: Date.now() + BOOKING_SERVICE_TIMEOUT_MS };

    if (getCorrelationId()) {
      client().GetBookingMetrics({ booking_id: bookingId }, correlationMetadata(), options, callback);
    } else {
      client().GetBookingMetrics({ booking_id: bookingId }, options, callback);
    }
  });

  return {
    totalAmount: Number(response.total_amount) || 0,
    ticketCount: Number(response.ticket_count) || 0,
    paidAt: response.paid_at || null
  };
}

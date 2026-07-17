import { fail, toGrpcError } from "@bus/shared/errors.js";
import { grpc, loadProto, readCorrelationId } from "@bus/shared/grpc.js";
import { runWithCorrelationId } from "@bus/shared/correlation.js";
import { dispatchOutboxEvents } from "@bus/shared/outbox.js";
import { startHealthServer } from "@bus/shared/health.js";
import { startTripCompletedConsumer } from "./consumers/tripCompletedConsumer.js";
import { simulatePaymentWithService } from "./payment-client.js";
import { confirmSeats, releaseBookedSeats, releaseSeatHold, validateSeatHold } from "./seat-client.js";
import {
  cancelBooking,
  checkInPassenger,
  createBooking,
  deletePassengerProfile,
  fetchBookingByCode,
  findBookingByHoldToken,
  getBookingMetrics,
  getBookingStatus,
  isPaymentSettledStatus,
  listAdminBookings,
  listCustomerBookings,
  listEventLogs,
  listPassengerProfiles,
  savePassengerProfile,
  settleBookingPayment,
  expirePendingBookings
} from "./repository.js";

async function handle(call, callback, work) {
  try {
    const result = await runWithCorrelationId(readCorrelationId(call), () => work(call.request));
    callback(null, result);
  } catch (error) {
    console.error("[booking-service]", error);
    callback(toGrpcError(error));
  }
}

async function simulatePayment(request) {
  if (!request.booking_code || !request.email) {
    fail("VALIDATION_ERROR", "booking_code and email are required");
  }

  let confirmedSeats = null;
  let transition;
  try {
    transition = await settleBookingPayment({
      bookingCode: request.booking_code,
      email: request.email,
      success: request.success,
      processPayment: async (booking) => {
        const payment = await simulatePaymentWithService({
          booking,
          success: request.success
        });

        if (!payment.success) {
          fail("PAYMENT_FAILED", "Simulated payment failed");
        }

        const seatIds = booking.passengers.map((passenger) => passenger.seat_id);
        await confirmSeats({
          tripId: booking.trip_id,
          seatIds,
          holdToken:
            process.env.SKIP_SEAT_CONFIRMATION === "true" ? "skipped" : booking.hold_token || "",
          bookingId: booking.id
        });
        confirmedSeats = {
          bookingId: booking.id,
          tripId: booking.trip_id,
          seatIds
        };
      }
    });
  } catch (error) {
    if (confirmedSeats) {
      try {
        const current = await fetchBookingByCode(request.booking_code);
        if (current && !isPaymentSettledStatus(current.status)) {
          await releaseBookedSeats(confirmedSeats);
        }
      } catch (compensationError) {
        console.error(
          `[booking-service] Failed to compensate confirmed seats for ${request.booking_code}: ${compensationError.message}`
        );
      }
    }
    throw error;
  }

  // booking.paid is queued to the outbox inside settleBookingPayment's own
  // transaction (see repository.js) and dispatched by the poller below.
  return transition.booking;
}

async function createBookingWithEvents(request) {
  const existing = await findBookingByHoldToken(request);
  if (existing) {
    return existing;
  }

  const seatIds = (request.passengers || []).map((passenger) => passenger.seat_id);
  await validateSeatHold({
    tripId: request.trip_id,
    seatIds,
    holdToken: request.hold_token || ""
  });

  // booking.created is queued to the outbox inside createBooking's own
  // transaction when a new row is actually inserted.
  const result = await createBooking(request);
  return result.booking;
}

async function cancelBookingWithEvents(request) {
  const booking = await cancelBooking(request);

  // Seat Inventory owns seat state; release through its RPC after commit for
  // the fast path. The transactional booking.cancelled workflow event provides
  // idempotent recovery if this immediate call fails.
  const seatIds = booking.passengers.map((passenger) => passenger.seat_id);
  try {
    await releaseBookedSeats({
      tripId: booking.trip_id,
      seatIds,
      bookingId: booking.id
    });
  } catch (error) {
    console.warn(
      `[booking-service] Failed to release booked seats for cancelled booking ${booking.booking_code}: ${error.message}`
    );
  }

  // booking.cancelled is queued to the outbox inside cancelBooking's own transaction.
  return booking;
}

async function checkInWithEvents(request) {
  // ticket.checked_in is queued to the outbox inside checkInPassenger's own transaction.
  return checkInPassenger(request);
}

if (process.env.DISABLE_RABBITMQ !== "true") {
  await startTripCompletedConsumer();
}

const proto = loadProto("booking.proto");
const server = new grpc.Server();

server.addService(proto.bus.booking.v1.BookingService.service, {
  CreateBooking: (call, callback) => handle(call, callback, createBookingWithEvents),
  GetBookingStatus: (call, callback) => handle(call, callback, getBookingStatus),
  ListCustomerBookings: (call, callback) => handle(call, callback, listCustomerBookings),
  ListAdminBookings: (call, callback) => handle(call, callback, listAdminBookings),
  SimulatePayment: (call, callback) => handle(call, callback, simulatePayment),
  CancelBooking: (call, callback) => handle(call, callback, cancelBookingWithEvents),
  CheckInPassenger: (call, callback) => handle(call, callback, checkInWithEvents),
  SavePassengerProfile: (call, callback) => handle(call, callback, savePassengerProfile),
  DeletePassengerProfile: (call, callback) => handle(call, callback, deletePassengerProfile),
  ListPassengerProfiles: (call, callback) => handle(call, callback, listPassengerProfiles),
  ListEventLogs: (call, callback) => handle(call, callback, listEventLogs),
  GetBookingMetrics: (call, callback) => handle(call, callback, getBookingMetrics)
});

const address = process.env.BOOKING_GRPC_URL || `0.0.0.0:${process.env.BOOKING_SERVICE_PORT || 50053}`;
server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (error, port) => {
  if (error) {
    console.error("[booking-service] failed to start", error);
    process.exit(1);
  }
  server.start();
  console.log(`[booking-service] gRPC listening on ${address} (port ${port})`);
});

const healthPort = Number(process.env.BOOKING_SERVICE_HEALTH_PORT || 50153);
startHealthServer(healthPort, "booking-service");
console.log(`[booking-service] health check on port ${healthPort}`);

async function runExpirationJob() {
  try {
    const expiredList = await expirePendingBookings(300); // 5 minutes TTL
    for (const b of expiredList) {
      console.log(`[booking-service] Expired booking: ${b.bookingCode}`);

      if (b.holdToken) {
        try {
          await releaseSeatHold({ holdToken: b.holdToken });
        } catch (error) {
          console.warn(
            `[booking-service] Failed to release expired hold ${b.holdToken}: ${error.message}`
          );
        }
      }
      // booking.expired is queued to the outbox inside expirePendingBookings's own transaction.
    }
  } catch (error) {
    console.error("[booking-service] Expiration job failed", error);
  }
}

async function runOutboxDispatchJob() {
  try {
    await dispatchOutboxEvents({ aggregateTypes: ["booking"] });
  } catch (error) {
    console.error("[booking-service] Outbox dispatch failed", error);
  }
}

setInterval(runExpirationJob, 15_000);
setInterval(runOutboxDispatchJob, 3_000);

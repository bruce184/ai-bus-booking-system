import { publishKafkaEvent, publishWorkflowEvent } from "@bus/shared/events.js";
import { fail, toGrpcError } from "@bus/shared/errors.js";
import { grpc, loadProto } from "@bus/shared/grpc.js";
import { simulatePaymentWithService } from "./payment-client.js";
import { confirmSeats, releaseBookedSeats, releaseSeatHold, validateSeatHold } from "./seat-client.js";
import {
  cancelBooking,
  checkInPassenger,
  createBooking,
  deletePassengerProfile,
  fetchBookingByCode,
  findBookingByHoldToken,
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
    callback(null, await work(call.request));
  } catch (error) {
    console.error("[booking-service]", error);
    callback(toGrpcError(error));
  }
}

async function simulatePayment(request) {
  if (!request.booking_code) {
    fail("VALIDATION_ERROR", "booking_code is required");
  }

  let confirmedSeats = null;
  let transition;
  try {
    transition = await settleBookingPayment({
      bookingCode: request.booking_code,
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

  const paidBooking = transition.booking;
  if (!transition.transitioned) {
    return paidBooking;
  }

  const seatIds = paidBooking.passengers.map((passenger) => passenger.seat_id);
  const eventPayload = {
    bookingId: paidBooking.id,
    bookingCode: paidBooking.booking_code,
    tripId: paidBooking.trip_id,
    contactEmail: paidBooking.contact_email,
    totalAmount: paidBooking.total_amount,
    seatIds
  };

  await publishWorkflowEvent("booking.paid", eventPayload);
  await publishKafkaEvent("booking-events", "booking.paid", eventPayload);

  return paidBooking;
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

  const result = await createBooking(request);
  if (result.created) {
    await publishKafkaEvent("booking-events", "booking.created", {
      bookingId: result.booking.id,
      bookingCode: result.booking.booking_code,
      tripId: result.booking.trip_id,
      totalAmount: result.booking.total_amount,
      passengerCount: result.booking.passengers.length
    });
  }
  return result.booking;
}

async function cancelBookingWithEvents(request) {
  const booking = await cancelBooking(request);

  // Seat Inventory owns seat state; release the booked seats through its RPC
  // after the cancellation transaction has committed. A failure here leaves
  // the seats BOOKED (no overselling) and is logged for manual follow-up.
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

  await publishKafkaEvent("booking-events", "booking.cancelled", {
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    tripId: booking.trip_id
  });
  return booking;
}

async function checkInWithEvents(request) {
  const booking = await checkInPassenger(request);
  await publishKafkaEvent("checkin-events", "ticket.checked_in", {
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    tripId: booking.trip_id
  });
  return booking;
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
  ListEventLogs: (call, callback) => handle(call, callback, listEventLogs)
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

async function runExpirationJob() {
  try {
    const expiredList = await expirePendingBookings(300); // 5 minutes TTL
    for (const b of expiredList) {
      console.log(`[booking-service] Expired booking: ${b.bookingCode}`);
      
      const eventPayload = {
        bookingId: b.bookingId,
        bookingCode: b.bookingCode,
        tripId: b.tripId,
        holdToken: b.holdToken,
        seatIds: b.seatIds
      };

      if (b.holdToken) {
        try {
          await releaseSeatHold({ holdToken: b.holdToken });
        } catch (error) {
          console.warn(
            `[booking-service] Failed to release expired hold ${b.holdToken}: ${error.message}`
          );
        }
      }

      await publishWorkflowEvent("booking.expired", eventPayload);
    }
  } catch (error) {
    console.error("[booking-service] Expiration job failed", error);
  }
}

setInterval(runExpirationJob, 15_000);

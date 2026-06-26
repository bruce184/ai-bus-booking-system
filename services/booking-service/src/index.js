import { publishKafkaEvent, publishWorkflowEvent } from "@bus/shared/events.js";
import { fail, toGrpcError } from "@bus/shared/errors.js";
import { grpc, loadProto } from "@bus/shared/grpc.js";
import { confirmSeats } from "./seat-client.js";
import {
  cancelBooking,
  checkInPassenger,
  createBooking,
  deletePassengerProfile,
  fetchBookingByCode,
  getBookingStatus,
  listAdminBookings,
  listCustomerBookings,
  listPassengerProfiles,
  markBookingPaid,
  savePassengerProfile
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

  const booking = await fetchBookingByCode(request.booking_code);
  if (!booking) {
    fail("NOT_FOUND", "Booking not found");
  }

  if (!request.success) {
    await publishKafkaEvent("payment-events", "payment.simulated_failure", {
      bookingId: booking.id,
      bookingCode: booking.booking_code
    });
    fail("PAYMENT_FAILED", "Simulated payment failed");
  }

  if (booking.status === "PAID" || booking.status === "TICKET_ISSUED") {
    return booking;
  }
  if (booking.status !== "PENDING_PAYMENT") {
    fail("BOOKING_STATE_INVALID", `Cannot pay booking in ${booking.status} status`);
  }

  const seatIds = booking.passengers.map((passenger) => passenger.seat_id);
  await confirmSeats({
    tripId: booking.trip_id,
    seatIds,
    holdToken: process.env.SKIP_SEAT_CONFIRMATION === "true" ? "skipped" : booking.hold_token || "",
    bookingId: booking.id
  });

  const paidBooking = await markBookingPaid({ bookingId: booking.id });
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
  await publishKafkaEvent("payment-events", "payment.simulated_success", eventPayload);

  return paidBooking;
}

async function createBookingWithEvents(request) {
  const booking = await createBooking(request);
  await publishKafkaEvent("booking-events", "booking.created", {
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    tripId: booking.trip_id,
    totalAmount: booking.total_amount,
    passengerCount: booking.passengers.length
  });
  return booking;
}

async function cancelBookingWithEvents(request) {
  const booking = await cancelBooking(request);
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
  ListPassengerProfiles: (call, callback) => handle(call, callback, listPassengerProfiles)
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

export const BOOKING_STATUSES = new Set([
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "TICKET_ISSUED",
  "CHECKED_IN",
  "COMPLETED",
  "EXPIRED",
  "CANCELLED"
]);

export function assertPendingPayment(status) {
  return status === "PENDING_PAYMENT";
}

export function canCancel(status) {
  return status === "PAID";
}

export function canCheckIn(status) {
  return status === "TICKET_ISSUED";
}

// Docs only rule out cancelled trips explicitly ("check-in flows must respect
// trip state"); DEPARTED stays allowed for late boarding in the local demo.
export function canCheckInTripState(tripStatus) {
  return tripStatus !== "CANCELLED";
}

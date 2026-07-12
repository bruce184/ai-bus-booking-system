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

// Matches the cancellation policy text Trip Service serves with trip detail
// (services/trip-service/src/policies.js CANCELLATION_POLICY): refund tiers
// only make sense before this cutoff, so self-service cancellation closes at
// the same line the policy already promises "no refund" past.
export const CANCELLATION_CUTOFF_HOURS = 24;

export function canCancelBeforeDeparture(departureTime, now = new Date()) {
  const hoursUntilDeparture = (new Date(departureTime).getTime() - now.getTime()) / 3_600_000;
  return hoursUntilDeparture >= CANCELLATION_CUTOFF_HOURS;
}

export function canCheckIn(status) {
  return status === "TICKET_ISSUED";
}

// Docs only rule out cancelled trips explicitly ("check-in flows must respect
// trip state"); DEPARTED stays allowed for late boarding in the local demo.
export function canCheckInTripState(tripStatus) {
  return tripStatus !== "CANCELLED";
}

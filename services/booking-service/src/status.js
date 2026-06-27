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
  return status === "PAID" || status === "TICKET_ISSUED";
}

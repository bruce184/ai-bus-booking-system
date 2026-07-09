// TN-4: consumes `payment-events` (payment.simulated_success / payment.simulated_failure).
//
// ASSUMPTION: this handler logs payment events but does not write to
// analytics_daily. Revenue and paid_booking_count are already recorded once
// by the booking-events handler on `booking.paid` (TN-3); writing them again
// here would double-count, since a successful payment always precedes
// `booking.paid` for the same booking. The documented `analytics_daily`
// schema (docs/DATABASE_SCHEMA.md section 10) also has no dedicated
// payment-success/failure-rate column. If a separate payment success/failure
// metric is wanted on the dashboard, that needs a schema change - flagged as
// an out-of-scope backlog item rather than invented here.
export async function handlePaymentEvent({ eventName, payload }) {
  if (eventName !== "payment.simulated_success" && eventName !== "payment.simulated_failure") {
    console.warn(`[analytics-service] unexpected payment-events eventName: ${eventName}`);
    return;
  }

  console.log(
    `[analytics-service] ${eventName} received for booking ${payload?.bookingCode ?? "unknown"} (log only, no analytics_daily field)`
  );
}

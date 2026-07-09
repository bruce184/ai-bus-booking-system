// TN-3: consumes `booking-events` and updates analytics_daily.paid_booking_count,
// revenue, tickets_sold, and search_to_paid_rate.
//
// Only `booking.paid` and `booking.cancelled` write to analytics_daily.
// `booking.created` fires while the booking is still PENDING_PAYMENT and has
// no corresponding column in the documented `analytics_daily` schema
// (see docs/DATABASE_SCHEMA.md section 10) - it is logged only. Adding a
// "created/pending" counter would be a schema change outside this task's
// scope; see the completion report's "Out-of-scope issues found" note.
import {
  applyPaidBookingDelta,
  getBookingAmountAndTicketCount,
  getRouteLabelForTrip
} from "../../repository/analyticsRepository.js";
import { toMetricDate } from "../../utils/date.js";

const FALLBACK_ROUTE_LABEL = "Unknown Route";

export async function handleBookingEvent({ eventName, payload, occurredAt }) {
  switch (eventName) {
    case "booking.created":
      console.log(
        `[analytics-service] booking.created received (no analytics_daily field for this event): ${payload?.bookingCode}`
      );
      return;
    case "booking.paid":
      return handleBookingPaid(payload, occurredAt);
    case "booking.cancelled":
      return handleBookingCancelled(payload, occurredAt);
    default:
      console.warn(`[analytics-service] unexpected booking-events eventName: ${eventName}`);
  }
}

async function resolveRouteLabel(tripId) {
  if (!tripId) {
    return FALLBACK_ROUTE_LABEL;
  }
  const routeLabel = await getRouteLabelForTrip(tripId);
  return routeLabel ?? FALLBACK_ROUTE_LABEL;
}

async function handleBookingPaid(payload, occurredAt) {
  const tripId = payload?.tripId;
  const totalAmount = Number(payload?.totalAmount ?? 0);
  const ticketCount = Array.isArray(payload?.seatIds) ? payload.seatIds.length : 0;

  if (!tripId) {
    console.warn("[analytics-service] booking.paid missing tripId; skipping", payload);
    return;
  }

  const routeLabel = await resolveRouteLabel(tripId);
  const metricDate = toMetricDate(occurredAt);

  await applyPaidBookingDelta({
    metricDate,
    routeLabel,
    paidBookingDelta: 1,
    revenueDelta: totalAmount,
    ticketsSoldDelta: ticketCount
  });
}

async function handleBookingCancelled(payload, occurredAt) {
  const tripId = payload?.tripId;
  const bookingId = payload?.bookingId;

  if (!tripId || !bookingId) {
    console.warn("[analytics-service] booking.cancelled missing tripId/bookingId; skipping", payload);
    return;
  }

  const routeLabel = await resolveRouteLabel(tripId);
  const { totalAmount, ticketCount } = await getBookingAmountAndTicketCount(bookingId);
  // NOTE (assumption): the booking state machine only allows PAID -> CANCELLED,
  // so a cancelled booking was previously counted as paid. The cancellation
  // is reversed against the CURRENT day's row (day of cancellation), not the
  // original payment day, because `bookings` has no separate `paid_at` column
  // (only `updated_at`, which is overwritten by the cancellation itself) to
  // recover which day originally received the credit. See completion report.
  const metricDate = toMetricDate(occurredAt);

  await applyPaidBookingDelta({
    metricDate,
    routeLabel,
    paidBookingDelta: -1,
    revenueDelta: -totalAmount,
    ticketsSoldDelta: -ticketCount
  });
}

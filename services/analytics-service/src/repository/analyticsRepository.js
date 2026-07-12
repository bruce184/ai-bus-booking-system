import { pool } from "../db/postgres.js";
import { getTripRouteLabel } from "../trip-client.js";
import { getBookingMetrics as fetchBookingMetrics } from "../booking-client.js";

/**
 * Consumer idempotency (Tuan04): records the eventId in the same transaction
 * as the handler's aggregate write, so a crash or thrown error mid-handler
 * rolls back the marker too and the event is retried instead of silently
 * marked-but-never-applied. Returns false when the event was already
 * processed, so Kafka redeliveries (rebalance, offset replay) cannot
 * double-count aggregates.
 */
export async function markEventProcessed(client, eventId, topic) {
  const { rowCount } = await client.query(
    `insert into processed_events (event_id, topic)
     values ($1, $2)
     on conflict (event_id) do nothing`,
    [eventId, topic]
  );
  return rowCount > 0;
}

/**
 * Increments `search_count` for (metric_date, route_label) by 1 and
 * recomputes `search_to_paid_rate` from the (possibly stale) existing
 * `paid_booking_count`. Atomic single-statement upsert; safe under concurrent
 * writers because Postgres serializes conflicting upserts per row.
 */
export async function upsertSearchCount(client, { metricDate, routeLabel }) {
  const { rows } = await client.query(
    `insert into analytics_daily (metric_date, route_label, search_count)
     values ($1, $2, 1)
     on conflict (metric_date, route_label)
     do update set
       search_count = analytics_daily.search_count + 1,
       search_to_paid_rate = case
         when (analytics_daily.search_count + 1) > 0
         then round((analytics_daily.paid_booking_count::numeric / (analytics_daily.search_count + 1)) * 100, 2)
         else 0
       end
     returning *`,
    [metricDate, routeLabel]
  );
  return rows[0];
}

/**
 * Applies a signed delta to paid_booking_count / revenue / tickets_sold for
 * (metric_date, route_label), then recomputes search_to_paid_rate from the
 * resulting paid_booking_count and the row's search_count.
 * Deltas are clamped at 0 so out-of-order or partial demo events can never
 * push a metric negative.
 */
export async function applyPaidBookingDelta(client, {
  metricDate,
  routeLabel,
  paidBookingDelta = 0,
  revenueDelta = 0,
  ticketsSoldDelta = 0
}) {
  const { rows } = await client.query(
    `insert into analytics_daily (metric_date, route_label, paid_booking_count, revenue, tickets_sold)
     values ($1, $2, greatest($3, 0), greatest($4, 0), greatest($5, 0))
     on conflict (metric_date, route_label)
     do update set
       paid_booking_count = greatest(analytics_daily.paid_booking_count + $3, 0),
       revenue = greatest(analytics_daily.revenue + $4, 0),
       tickets_sold = greatest(analytics_daily.tickets_sold + $5, 0),
       search_to_paid_rate = case
         when analytics_daily.search_count > 0
         then round((greatest(analytics_daily.paid_booking_count + $3, 0)::numeric / analytics_daily.search_count) * 100, 2)
         else 0
       end
     returning *`,
    [metricDate, routeLabel, paidBookingDelta, revenueDelta, ticketsSoldDelta]
  );
  return rows[0];
}

/**
 * Human-readable route label ("Origin -> Destination") for a trip id,
 * matching the label format the search-events handler builds from raw
 * origin/destination search strings. Trip Service owns trips/routes/
 * locations (database-per-service - docs/ARCHITECTURE.md section 11), so
 * this calls its GetTripDetail RPC instead of joining those tables directly.
 */
export async function getRouteLabelForTrip(tripId) {
  try {
    return await getTripRouteLabel(tripId);
  } catch (error) {
    console.warn(`[analytics-service] Trip Service lookup failed for ${tripId}: ${error.message}`);
    return null;
  }
}

/**
 * Reads the values originally applied by `booking.paid`, including the
 * transactionally recorded payment time. This lets cancellation reverse the
 * exact daily aggregate row that received the payment. Booking Service owns
 * bookings/booking_passengers/event_logs, so this calls its internal
 * GetBookingMetrics RPC instead of joining those tables directly.
 */
export async function getBookingCancellationMetrics(bookingId) {
  try {
    return await fetchBookingMetrics(bookingId);
  } catch (error) {
    console.warn(`[analytics-service] Booking Service lookup failed for ${bookingId}: ${error.message}`);
    // Matches the "no booking.paid event log" shape handleBookingCancelled
    // already treats as skip-the-reversal, rather than losing the whole
    // Kafka message to an unrelated network blip.
    return { totalAmount: 0, ticketCount: 0, paidAt: null };
  }
}

export async function getRevenueSummary({ from, to }) {
  const { rows } = await pool.query(
    `select
       coalesce(sum(revenue), 0)::int as total_revenue,
       coalesce(sum(paid_booking_count), 0)::int as paid_bookings,
       coalesce(sum(tickets_sold), 0)::int as tickets_sold,
       coalesce(sum(search_count), 0)::int as search_count
     from analytics_daily
     where metric_date between $1 and $2`,
    [from, to]
  );

  const row = rows[0] ?? {};
  const paidBookings = Number(row.paid_bookings) || 0;
  const searchCount = Number(row.search_count) || 0;

  return {
    from,
    to,
    totalRevenue: Number(row.total_revenue) || 0,
    paidBookings,
    ticketsSold: Number(row.tickets_sold) || 0,
    successfulBookingRate: searchCount > 0 ? Number(((paidBookings / searchCount) * 100).toFixed(2)) : 0
  };
}

export async function getDailyRevenue({ from, to }) {
  const { rows } = await pool.query(
    `select
       metric_date::text as date,
       coalesce(sum(revenue), 0)::int as revenue,
       coalesce(sum(paid_booking_count), 0)::int as paid_bookings,
       coalesce(sum(tickets_sold), 0)::int as tickets_sold
     from analytics_daily
     where metric_date between $1 and $2
     group by metric_date
     order by metric_date asc`,
    [from, to]
  );

  return rows.map((row) => ({
    date: row.date,
    revenue: Number(row.revenue) || 0,
    paidBookings: Number(row.paid_bookings) || 0,
    ticketsSold: Number(row.tickets_sold) || 0
  }));
}

export async function getTicketsByRoute({ from, to }) {
  const { rows } = await pool.query(
    `select
       coalesce(route_label, 'Unknown Route') as route_label,
       coalesce(sum(tickets_sold), 0)::int as tickets_sold,
       coalesce(sum(revenue), 0)::int as revenue
     from analytics_daily
     where metric_date between $1 and $2
     group by route_label
     having coalesce(sum(tickets_sold), 0) > 0 or coalesce(sum(revenue), 0) > 0
     order by tickets_sold desc, revenue desc`,
    [from, to]
  );

  return rows.map((row) => {
    const [origin = row.route_label, destination = ""] = String(row.route_label).split(" -> ");
    return {
      origin,
      destination,
      ticketsSold: Number(row.tickets_sold) || 0,
      revenue: Number(row.revenue) || 0
    };
  });
}

export async function getPopularRoutes({ from, to, limit = 5 }) {
  const { rows } = await pool.query(
    `select
       coalesce(route_label, 'Unknown Route') as route_label,
       coalesce(sum(search_count), 0)::int as search_count
     from analytics_daily
     where metric_date between $1 and $2
     group by route_label
     having coalesce(sum(search_count), 0) > 0
     order by search_count desc
     limit $3`,
    [from, to, limit]
  );

  return rows.map((row) => {
    const [origin = row.route_label, destination = ""] = String(row.route_label).split(" -> ");
    return {
      origin,
      destination,
      searchCount: Number(row.search_count) || 0
    };
  });
}

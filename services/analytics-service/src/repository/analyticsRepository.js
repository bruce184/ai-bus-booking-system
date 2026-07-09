import { pool } from "../db/postgres.js";

/**
 * Increments `search_count` for (metric_date, route_label) by 1 and
 * recomputes `search_to_paid_rate` from the (possibly stale) existing
 * `paid_booking_count`. Atomic single-statement upsert; safe under concurrent
 * writers because Postgres serializes conflicting upserts per row.
 */
export async function upsertSearchCount({ metricDate, routeLabel }) {
  const { rows } = await pool.query(
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
export async function applyPaidBookingDelta({
  metricDate,
  routeLabel,
  paidBookingDelta = 0,
  revenueDelta = 0,
  ticketsSoldDelta = 0
}) {
  const { rows } = await pool.query(
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
 * Reads-only join to build a human-readable route label ("Origin - Destination")
 * from a trip id, matching the label format the search-events handler builds
 * from raw origin/destination search strings. Trip Service owns trips/routes/
 * locations; this is a read-only cross-service lookup for analytics enrichment,
 * not a write.
 */
export async function getRouteLabelForTrip(tripId) {
  const { rows } = await pool.query(
    `select ol.name as origin_name, dl.name as destination_name
     from trips t
     join routes r on r.id = t.route_id
     join locations ol on ol.id = r.origin_location_id
     join locations dl on dl.id = r.destination_location_id
     where t.id = $1`,
    [tripId]
  );

  if (rows.length === 0) {
    return null;
  }

  const { origin_name: originName, destination_name: destinationName } = rows[0];
  return `${originName} - ${destinationName}`;
}

/**
 * Reads a booking's total_amount and issued seat/ticket count, used to reverse
 * a previously counted paid booking on `booking.cancelled` (see
 * bookingEventsHandler.js for why this lookup is necessary).
 */
export async function getBookingAmountAndTicketCount(bookingId) {
  const { rows } = await pool.query(
    `select b.total_amount as total_amount, count(bp.id)::int as ticket_count
     from bookings b
     left join booking_passengers bp on bp.booking_id = b.id
     where b.id = $1
     group by b.total_amount`,
    [bookingId]
  );

  if (rows.length === 0) {
    return { totalAmount: 0, ticketCount: 0 };
  }

  return {
    totalAmount: Number(rows[0].total_amount) || 0,
    ticketCount: Number(rows[0].ticket_count) || 0
  };
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
    const [origin = row.route_label, destination = ""] = String(row.route_label).split(" - ");
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
    const [origin = row.route_label, destination = ""] = String(row.route_label).split(" - ");
    return {
      origin,
      destination,
      searchCount: Number(row.search_count) || 0
    };
  });
}

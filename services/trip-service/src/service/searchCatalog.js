// Public search & catalog RPCs: AutocompleteLocations, SearchTrips,
// GetTripDetail, ListPopularRoutes.
import { query } from '../db.js';
import {
  getCachedSearch,
  setCachedSearch,
} from '../cache.js';
import { publishSearchPerformed } from '../events.js';
import { config } from '../config.js';
import { notFound, invalidArgument } from '../errors.js';
import { CANCELLATION_POLICY, CHECKIN_POLICY } from '../policies.js';
import { TRIP_SELECT, rowsToTrips, correctedAvailableSeats } from '../tripQuery.js';
import {
  mapLocation,
  mapStop,
  mapRoute,
  mapVehicle,
  mapTrip,
  buildSeoTitle,
} from '../mappers.js';
import { resolveSortBy } from '../searchRules.js';
import { fetchPopularRoutes } from '../analytics-client.js';

export async function autocompleteLocations(call) {
  const keyword = (call.request.keyword || '').trim();
  if (!keyword) return { locations: [] };
  const { rows } = await query(
    `select id, name, type, address from locations
       where name ilike $1
       order by (name ilike $2) desc, name asc
       limit 10`,
    [`%${keyword}%`, `${keyword}%`],
  );
  return { locations: rows.map(mapLocation) };
}

export async function searchTrips(call) {
  const req = call.request;
  const origin = (req.origin || '').trim();
  const destination = (req.destination || '').trim();
  const departureDate = (req.departure_date || '').trim();
  if (!origin || !destination || !departureDate) {
    throw invalidArgument('origin, destination and departure_date are required');
  }

  // Normalized cache key (ignores ephemeral fields).
  const cacheParams = {
    origin: origin.toLowerCase(),
    destination: destination.toLowerCase(),
    departureDate,
    departureTimeFrom: req.departure_time_from || '',
    departureTimeTo: req.departure_time_to || '',
    minPrice: req.min_price || 0,
    maxPrice: req.max_price || 0,
    operatorName: req.operator_name || '',
    vehicleType: req.vehicle_type || '',
    minAvailableSeats: req.min_available_seats || 0,
    sortBy: req.sort_by || '',
  };

  const cached = await getCachedSearch(cacheParams);
  if (cached) {
    await publishSearchPerformed({
      origin,
      destination,
      departureDate,
      resultCount: cached.trips.length,
      cacheHit: true,
    });
    return { ...cached, cache_hit: true };
  }

  const params = [origin, destination, departureDate, config.timezone];
  const where = [
    `t.status = 'ACTIVE'`,
    `lower(ol.name) = lower($1)`,
    `lower(dl.name) = lower($2)`,
    `(t.departure_time at time zone $4::text)::date = $3::date`,
  ];

  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (req.departure_time_from) where.push(`(t.departure_time at time zone $4)::time >= ${addParam(req.departure_time_from)}::time`);
  if (req.departure_time_to) where.push(`(t.departure_time at time zone $4)::time <= ${addParam(req.departure_time_to)}::time`);
  if (req.min_price) where.push(`t.price >= ${addParam(req.min_price)}`);
  if (req.max_price) where.push(`t.price <= ${addParam(req.max_price)}`);
  if (req.operator_name) where.push(`v.operator_name ilike ${addParam(`%${req.operator_name}%`)}`);
  if (req.vehicle_type) where.push(`v.vehicle_type = ${addParam(req.vehicle_type)}`);

  const { rows } = await query(
    `${TRIP_SELECT} where ${where.join(' and ')} order by ${resolveSortBy(req.sort_by)}`,
    params,
  );

  let trips = await rowsToTrips(rows);
  if (req.min_available_seats) {
    trips = trips.filter((t) => t.available_seats >= req.min_available_seats);
  }

  const seoTitle = buildSeoTitle(origin, destination, `${departureDate}T00:00:00`, config.timezone);

  let suggestedDates = [];
  if (trips.length === 0) {
    suggestedDates = await findNearbyDates(origin, destination, departureDate);
  }

  const response = { trips, suggested_dates: suggestedDates, seo_title: seoTitle, cache_hit: false };
  await setCachedSearch(cacheParams, { trips, suggested_dates: suggestedDates, seo_title: seoTitle });
  await publishSearchPerformed({ origin, destination, departureDate, resultCount: trips.length, cacheHit: false });
  return response;
}

// Nearby active departure dates (within +/- 7 days) for empty results.
async function findNearbyDates(origin, destination, departureDate) {
  const { rows } = await query(
    `select distinct to_char((t.departure_time at time zone $4::text)::date, 'YYYY-MM-DD') as d
       from trips t
       join routes r on r.id = t.route_id
       join locations ol on ol.id = r.origin_location_id
       join locations dl on dl.id = r.destination_location_id
      where t.status = 'ACTIVE'
        and lower(ol.name) = lower($1)
        and lower(dl.name) = lower($2)
        and (t.departure_time at time zone $4::text)::date between $3::date - 7 and $3::date + 7
        and (t.departure_time at time zone $4::text)::date <> $3::date
      order by d asc
      limit 3`,
    [origin, destination, departureDate, config.timezone],
  );
  return rows.map((r) => r.d);
}

export async function getTripDetail(call) {
  const tripId = call.request.trip_id;
  if (!tripId) throw invalidArgument('trip_id is required');

  const { rows } = await query(`${TRIP_SELECT} where t.id = $1`, [tripId]);
  if (rows.length === 0) throw notFound('Trip not found');
  const row = rows[0];

  const stopsRes = await query(
    `select rs.id, rs.stop_type, rs.stop_order,
            l.name as location_name, l.address as location_address
       from route_stops rs
       join locations l on l.id = rs.location_id
      where rs.route_id = $1
      order by rs.stop_order asc`,
    [row.route_id],
  );

  const stops = stopsRes.rows.map(mapStop);
  const route = mapRoute(row, stops);
  const vehicle = mapVehicle(row, []);
  const seoTitle = buildSeoTitle(row.origin_name, row.destination_name, row.departure_time, config.timezone);
  const trip = mapTrip(row, { route, vehicle, availableSeats: await correctedAvailableSeats(row), seoTitle });

  return {
    trip,
    pickup_points: stops.filter((s) => s.stop_type === 'PICKUP'),
    dropoff_points: stops.filter((s) => s.stop_type === 'DROPOFF'),
    cancellation_policy: CANCELLATION_POLICY,
    checkin_policy: CHECKIN_POLICY,
  };
}

export async function listPopularRoutes(call) {
  const limit = Math.min(Math.max(call.request.limit || 5, 1), 50);

  // Analytics Service is the sole writer of analytics_daily. Trip Service owns
  // the public ListPopularRoutes RPC but reads this aggregate through
  // Analytics Service's own API instead of querying its table directly.
  const routes = await fetchPopularRoutes(limit);

  return {
    routes: routes
      .filter((r) => r.origin && r.destination)
      .map((r) => ({
        origin: r.origin,
        destination: r.destination,
        search_count: Number(r.searchCount) || 0,
      })),
  };
}

// Shared trip SELECT and row->Trip builder, used by both search and admin RPCs.
import { config } from './config.js';
import { mapRoute, mapVehicle, mapTrip, buildSeoTitle } from './mappers.js';
import { getHeldSeatCount } from './cache.js';

export const TRIP_SELECT = `
  select
    t.id, t.departure_time, t.arrival_time, t.price, t.status,
    r.id as route_id, r.distance_km,
    ol.id as origin_id, ol.name as origin_name, ol.type as origin_type, ol.address as origin_address,
    dl.id as destination_id, dl.name as destination_name, dl.type as destination_type, dl.address as destination_address,
    v.id as vehicle_id, v.operator_name, v.vehicle_code, v.license_plate, v.vehicle_type, v.seat_count,
    (select count(*) from trip_seats ts where ts.trip_id = t.id and ts.status = 'AVAILABLE')::int as available_seats
  from trips t
  join routes r on r.id = t.route_id
  join locations ol on ol.id = r.origin_location_id
  join locations dl on dl.id = r.destination_location_id
  join vehicles v on v.id = t.vehicle_id
`;

// trip_seats.status only reflects Redis holds once Seat Inventory confirms
// or releases them (see DATABASE_SCHEMA.md section 6) - while a hold is
// active the row is still 'AVAILABLE', so the raw DB count overcounts.
// Subtract currently-held seats so search/detail/admin listings agree with
// what the seat map itself already shows.
export async function correctedAvailableSeats(row) {
  const held = await getHeldSeatCount(row.id);
  return Math.max(0, Number(row.available_seats) - held);
}

export async function rowToTrip(row, stops = []) {
  const route = mapRoute(row, stops);
  const vehicle = mapVehicle(row, []);
  const seoTitle = buildSeoTitle(row.origin_name, row.destination_name, row.departure_time, config.timezone);
  return mapTrip(row, { route, vehicle, availableSeats: await correctedAvailableSeats(row), seoTitle });
}

export async function rowsToTrips(rows) {
  // Array.map passes the numeric index as its second callback argument, while
  // rowToTrip expects an optional route-stops array in that position.
  return Promise.all(rows.map((row) => rowToTrip(row)));
}

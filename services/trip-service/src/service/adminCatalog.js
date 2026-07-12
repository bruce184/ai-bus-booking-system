// Admin catalog RPCs: route, stop, vehicle (+ seat layout), and trip management.
import { pool, query } from '../db.js';
import { notFound, invalidArgument } from '../errors.js';
import { mapStop, mapVehicleSeat, mapRoute, mapVehicle, mapLocation } from '../mappers.js';
import { TRIP_SELECT, rowToTrip, rowsToTrips } from '../tripQuery.js';
import { logger } from '../logger.js';

// ---- helpers ----------------------------------------------------------------

async function fetchRoute(id) {
  const { rows } = await query(
    `select r.id as route_id, r.distance_km,
            ol.id as origin_id, ol.name as origin_name, ol.type as origin_type, ol.address as origin_address,
            dl.id as destination_id, dl.name as destination_name, dl.type as destination_type, dl.address as destination_address
       from routes r
       join locations ol on ol.id = r.origin_location_id
       join locations dl on dl.id = r.destination_location_id
      where r.id = $1`,
    [id],
  );
  if (rows.length === 0) throw notFound('Route not found');
  return mapRoute(rows[0], []);
}

async function fetchStop(id) {
  const { rows } = await query(
    `select rs.id, rs.stop_type, rs.stop_order,
            l.name as location_name, l.address as location_address
       from route_stops rs
       join locations l on l.id = rs.location_id
      where rs.id = $1`,
    [id],
  );
  if (rows.length === 0) throw notFound('Stop not found');
  return mapStop(rows[0]);
}

async function fetchVehicle(id) {
  const { rows } = await query(
    `select id, operator_name, vehicle_code, license_plate, vehicle_type, seat_count
       from vehicles where id = $1`,
    [id],
  );
  if (rows.length === 0) throw notFound('Vehicle not found');
  const v = rows[0];
  const seatRes = await query(
    `select id, seat_label, deck, seat_row, seat_column
       from vehicle_seats where vehicle_id = $1
       order by deck, seat_row, seat_column`,
    [id],
  );
  return mapVehicle(v, seatRes.rows.map(mapVehicleSeat));
}

async function fetchTrip(id) {
  const { rows } = await query(`${TRIP_SELECT} where t.id = $1`, [id]);
  if (rows.length === 0) throw notFound('Trip not found');
  return rowToTrip(rows[0]);
}

// Non-fatal operational logging. event_logs is a shared table; trip-domain
// actions are recorded here for the admin event-log view.
async function logEvent(eventType, entityType, entityId, payload) {
  try {
    await query(
      `insert into event_logs (event_type, entity_type, entity_id, payload)
       values ($1, $2, $3, $4::jsonb)`,
      [eventType, entityType, entityId, JSON.stringify(payload || {})],
    );
  } catch (err) {
    logger.warn('event_logs insert failed (non-fatal)', err.message);
  }
}

// ---- routes -----------------------------------------------------------------

export async function createRoute(call) {
  const { origin_location_id, destination_location_id, distance_km } = call.request;
  if (!origin_location_id || !destination_location_id) {
    throw invalidArgument('origin_location_id and destination_location_id are required');
  }
  const { rows } = await query(
    `insert into routes (origin_location_id, destination_location_id, distance_km)
       values ($1, $2, $3) returning id`,
    [origin_location_id, destination_location_id, distance_km || null],
  );
  return { route: await fetchRoute(rows[0].id) };
}

export async function updateRoute(call) {
  const { id, origin_location_id, destination_location_id, distance_km } = call.request;
  if (!id) throw invalidArgument('id is required');
  const { rowCount } = await query(
    `update routes set
        origin_location_id = coalesce($2, origin_location_id),
        destination_location_id = coalesce($3, destination_location_id),
        distance_km = coalesce($4, distance_km)
      where id = $1`,
    [id, origin_location_id || null, destination_location_id || null, distance_km || null],
  );
  if (rowCount === 0) throw notFound('Route not found');
  return { route: await fetchRoute(id) };
}

export async function deleteRoute(call) {
  const { id } = call.request;
  if (!id) throw invalidArgument('id is required');
  const { rowCount } = await query('delete from routes where id = $1', [id]);
  return { deleted: rowCount > 0 };
}

// ---- stops ------------------------------------------------------------------

export async function createStop(call) {
  const { route_id, location_id, stop_type, stop_order } = call.request;
  if (!route_id || !location_id) throw invalidArgument('route_id and location_id are required');
  if (!['PICKUP', 'DROPOFF'].includes(stop_type)) throw invalidArgument('stop_type must be PICKUP or DROPOFF');
  const { rows } = await query(
    `insert into route_stops (route_id, location_id, stop_type, stop_order)
       values ($1, $2, $3, $4) returning id`,
    [route_id, location_id, stop_type, stop_order || 1],
  );
  return { stop: await fetchStop(rows[0].id) };
}

export async function updateStop(call) {
  const { id, location_id, stop_type, stop_order } = call.request;
  if (!id) throw invalidArgument('id is required');
  if (stop_type && !['PICKUP', 'DROPOFF'].includes(stop_type)) {
    throw invalidArgument('stop_type must be PICKUP or DROPOFF');
  }
  const { rowCount } = await query(
    `update route_stops set
        location_id = coalesce($2, location_id),
        stop_type = coalesce($3, stop_type),
        stop_order = coalesce($4, stop_order)
      where id = $1`,
    [id, location_id || null, stop_type || null, stop_order || null],
  );
  if (rowCount === 0) throw notFound('Stop not found');
  return { stop: await fetchStop(id) };
}

export async function deleteStop(call) {
  const { id } = call.request;
  if (!id) throw invalidArgument('id is required');
  const { rowCount } = await query('delete from route_stops where id = $1', [id]);
  return { deleted: rowCount > 0 };
}

// ---- vehicles ---------------------------------------------------------------

export async function createVehicle(call) {
  const { operator_name, vehicle_code, license_plate, vehicle_type, seat_count } = call.request;
  if (!operator_name || !vehicle_code || !vehicle_type) {
    throw invalidArgument('operator_name, vehicle_code and vehicle_type are required');
  }
  const { rows } = await query(
    `insert into vehicles (operator_name, vehicle_code, license_plate, vehicle_type, seat_count)
       values ($1, $2, $3, $4, $5) returning id`,
    [operator_name, vehicle_code, license_plate || null, vehicle_type, seat_count || 0],
  );
  return { vehicle: await fetchVehicle(rows[0].id) };
}

export async function updateVehicle(call) {
  const { id, operator_name, vehicle_code, license_plate, vehicle_type, seat_count } = call.request;
  if (!id) throw invalidArgument('id is required');
  const { rowCount } = await query(
    `update vehicles set
        operator_name = coalesce($2, operator_name),
        vehicle_code = coalesce($3, vehicle_code),
        license_plate = coalesce($4, license_plate),
        vehicle_type = coalesce($5, vehicle_type),
        seat_count = coalesce($6, seat_count)
      where id = $1`,
    [id, operator_name || null, vehicle_code || null, license_plate || null, vehicle_type || null, seat_count || null],
  );
  if (rowCount === 0) throw notFound('Vehicle not found');
  return { vehicle: await fetchVehicle(id) };
}

export async function deleteVehicle(call) {
  const { id } = call.request;
  if (!id) throw invalidArgument('id is required');
  const { rowCount } = await query('delete from vehicles where id = $1', [id]);
  return { deleted: rowCount > 0 };
}

// Replaces the full seat layout for a vehicle in one transaction.
export async function configureVehicleSeats(call) {
  const { vehicle_id, seats } = call.request;
  if (!vehicle_id) throw invalidArgument('vehicle_id is required');
  const list = seats || [];

  const client = await pool.connect();
  try {
    await client.query('begin');
    const exists = await client.query('select 1 from vehicles where id = $1', [vehicle_id]);
    if (exists.rowCount === 0) throw notFound('Vehicle not found');

    await client.query('delete from vehicle_seats where vehicle_id = $1', [vehicle_id]);
    for (const s of list) {
      await client.query(
        `insert into vehicle_seats (vehicle_id, seat_label, deck, seat_row, seat_column)
           values ($1, $2, $3, $4, $5)`,
        [vehicle_id, s.label, s.deck || 1, s.row || 0, s.column || 0],
      );
    }
    await client.query('update vehicles set seat_count = $2 where id = $1', [vehicle_id, list.length]);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await query(
    `select id, seat_label, deck, seat_row, seat_column
       from vehicle_seats where vehicle_id = $1
       order by deck, seat_row, seat_column`,
    [vehicle_id],
  );
  return { seats: rows.map(mapVehicleSeat) };
}

// ---- trips ------------------------------------------------------------------

const VALID_TRIP_STATUS = ['DRAFT', 'ACTIVE', 'LOCKED', 'DEPARTED', 'COMPLETED', 'CANCELLED'];

// Creates a trip and materializes its trip_seats from the vehicle layout.
export async function createTrip(call) {
  const { route_id, vehicle_id, departure_time, arrival_time, price } = call.request;
  const status = call.request.status && call.request.status !== 'TRIP_STATUS_UNSPECIFIED'
    ? call.request.status
    : 'DRAFT';
  if (!route_id || !vehicle_id || !departure_time || !arrival_time) {
    throw invalidArgument('route_id, vehicle_id, departure_time and arrival_time are required');
  }
  if (!VALID_TRIP_STATUS.includes(status)) throw invalidArgument('invalid trip status');

  const client = await pool.connect();
  let tripId;
  try {
    await client.query('begin');
    const tripRes = await client.query(
      `insert into trips (route_id, vehicle_id, departure_time, arrival_time, price, status)
         values ($1, $2, $3, $4, $5, $6) returning id`,
      [route_id, vehicle_id, departure_time, arrival_time, price || 0, status],
    );
    tripId = tripRes.rows[0].id;
    await client.query(
      `insert into trip_seats (trip_id, seat_label, status)
         select $1, seat_label, 'AVAILABLE' from vehicle_seats where vehicle_id = $2`,
      [tripId, vehicle_id],
    );
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  await logEvent('trip.created', 'trip', tripId, { route_id, vehicle_id, status });
  return { trip: await fetchTrip(tripId) };
}

export async function updateTrip(call) {
  const { id, route_id, vehicle_id, departure_time, arrival_time, price } = call.request;
  if (!id) throw invalidArgument('id is required');
  const status = call.request.status && call.request.status !== 'TRIP_STATUS_UNSPECIFIED'
    ? call.request.status
    : null;
  if (status && !VALID_TRIP_STATUS.includes(status)) throw invalidArgument('invalid trip status');

  const client = await pool.connect();
  let vehicleChanging = false;
  try {
    await client.query('begin');

    const current = await client.query('select vehicle_id from trips where id = $1 for update', [id]);
    if (current.rowCount === 0) throw notFound('Trip not found');

    vehicleChanging = Boolean(vehicle_id) && vehicle_id !== current.rows[0].vehicle_id;
    if (vehicleChanging) {
      // The old vehicle's trip_seats are about to be replaced with the new
      // vehicle's layout - refuse if any seat already has a real hold/booking
      // on it instead of silently orphaning that passenger's seat.
      const occupied = await client.query(
        `select 1 from trip_seats where trip_id = $1 and status <> 'AVAILABLE' limit 1`,
        [id],
      );
      if (occupied.rowCount > 0) {
        throw invalidArgument('Cannot change vehicle: trip already has held, booked, or blocked seats');
      }
    }

    await client.query(
      `update trips set
          route_id = coalesce($2, route_id),
          vehicle_id = coalesce($3, vehicle_id),
          departure_time = coalesce($4, departure_time),
          arrival_time = coalesce($5, arrival_time),
          price = coalesce($6, price),
          status = coalesce($7, status)
        where id = $1`,
      [id, route_id || null, vehicle_id || null, departure_time || null, arrival_time || null, price || null, status],
    );

    if (vehicleChanging) {
      await client.query('delete from trip_seats where trip_id = $1', [id]);
      await client.query(
        `insert into trip_seats (trip_id, seat_label, status)
           select $1, seat_label, 'AVAILABLE' from vehicle_seats where vehicle_id = $2`,
        [id, vehicle_id],
      );
    }

    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  if (vehicleChanging) {
    await logEvent('trip.vehicle_changed', 'trip', id, { vehicle_id });
  }

  return { trip: await fetchTrip(id) };
}

export async function deleteTrip(call) {
  const { id } = call.request;
  if (!id) throw invalidArgument('id is required');
  const { rowCount } = await query('delete from trips where id = $1', [id]);
  return { deleted: rowCount > 0 };
}

export async function updateTripStatus(call) {
  const { trip_id, status } = call.request;
  if (!trip_id) throw invalidArgument('trip_id is required');
  if (!VALID_TRIP_STATUS.includes(status)) throw invalidArgument('invalid trip status');
  const { rowCount } = await query('update trips set status = $2 where id = $1', [trip_id, status]);
  if (rowCount === 0) throw notFound('Trip not found');
  await logEvent('trip.status_changed', 'trip', trip_id, { status });
  return { trip: await fetchTrip(trip_id) };
}

export async function listLocations(call) {
  const { rows } = await query(
    `select id, name, type, address from locations order by name`
  );
  return { locations: rows.map(mapLocation) };
}

export async function listRoutes(call) {
  const { rows } = await query(
    `select r.id as route_id, r.distance_km,
            ol.id as origin_id, ol.name as origin_name, ol.type as origin_type, ol.address as origin_address,
            dl.id as destination_id, dl.name as destination_name, dl.type as destination_type, dl.address as destination_address
       from routes r
       join locations ol on ol.id = r.origin_location_id
       join locations dl on dl.id = r.destination_location_id
      order by r.id`
  );
  const routes = [];
  for (const row of rows) {
    const stopRes = await query(
      `select rs.id, rs.route_id, rs.location_id, rs.stop_type, rs.stop_order,
              l.name as location_name, l.address as location_address
         from route_stops rs
         join locations l on l.id = rs.location_id
        where rs.route_id = $1
        order by rs.stop_order`,
      [row.route_id]
    );
    routes.push(mapRoute(row, stopRes.rows.map(mapStop)));
  }
  return { routes };
}

export async function listVehicles(call) {
  const { rows } = await query(
    `select id, operator_name, vehicle_code, license_plate, vehicle_type, seat_count
       from vehicles order by id`
  );
  const vehicles = [];
  for (const v of rows) {
    const seatRes = await query(
      `select id, seat_label, deck, seat_row, seat_column
         from vehicle_seats where vehicle_id = $1
         order by deck, seat_row, seat_column`,
      [v.id]
    );
    vehicles.push(mapVehicle(v, seatRes.rows.map(mapVehicleSeat)));
  }
  return { vehicles };
}

export async function listTrips(call) {
  const { rows } = await query(`${TRIP_SELECT} order by t.departure_time desc`);
  return { trips: await rowsToTrips(rows) };
}

// Admin catalog RPCs: route, stop, vehicle (+ seat layout), and trip management.
import { pool, query } from '../db.js';
import { notFound, invalidArgument } from '../errors.js';
import { mapStop, mapVehicleSeat, mapRoute, mapVehicle, mapLocation } from '../mappers.js';
import { TRIP_SELECT, rowToTrip, rowsToTrips } from '../tripQuery.js';
import { logger } from '../logger.js';
import { withTripSeatMaintenance } from '../cache.js';
import { writeOutboxEvent } from '@bus/shared/outbox.js';
import {
  AdminInputError,
  assertTripStatusTransition,
  normalizeRouteInput,
  normalizeStopInput,
  normalizeTripInput,
  normalizeVehicleInput,
  normalizeVehicleSeatLayout,
  requiredText,
} from '@bus/shared/admin-contract.js';

// ---- helpers ----------------------------------------------------------------

function validateAdminInput(work) {
  try {
    return work();
  } catch (error) {
    if (error instanceof AdminInputError) {
      throw invalidArgument(error.message);
    }
    throw error;
  }
}

function routeRequest(request) {
  return validateAdminInput(() => normalizeRouteInput({
    originLocationId: request.origin_location_id,
    destinationLocationId: request.destination_location_id,
    distanceKm: request.distance_km || undefined,
  }));
}

function stopRequest(request) {
  return validateAdminInput(() => normalizeStopInput({
    routeId: request.route_id,
    locationId: request.location_id,
    stopType: request.stop_type,
    stopOrder: request.stop_order || 1,
  }));
}

function vehicleRequest(request) {
  return validateAdminInput(() => normalizeVehicleInput({
    operatorName: request.operator_name,
    vehicleCode: request.vehicle_code,
    licensePlate: request.license_plate,
    vehicleType: request.vehicle_type,
    seatCount: request.seat_count,
  }));
}

function tripRequest(request, { isUpdate = false } = {}) {
  const status = request.status === 'TRIP_STATUS_UNSPECIFIED'
    ? undefined
    : request.status;
  return validateAdminInput(() => normalizeTripInput({
    routeId: request.route_id,
    vehicleId: request.vehicle_id,
    departureTime: request.departure_time,
    arrivalTime: request.arrival_time,
    price: request.price,
    status,
  }, { isUpdate }));
}

async function requireRoute(client, routeId) {
  const route = await client.query('select 1 from routes where id = $1', [routeId]);
  if (route.rowCount === 0) throw notFound('Route not found');
}

async function readVehicleLayout(client, vehicleId) {
  const vehicle = await client.query(
    'select seat_count from vehicles where id = $1',
    [vehicleId],
  );
  if (vehicle.rowCount === 0) throw notFound('Vehicle not found');
  const layout = await client.query(
    'select count(*)::int as seat_count from vehicle_seats where vehicle_id = $1',
    [vehicleId],
  );
  return {
    declaredCount: Number(vehicle.rows[0].seat_count),
    layoutCount: Number(layout.rows[0]?.seat_count || 0),
  };
}

async function requireConfiguredVehicleLayout(client, vehicleId) {
  const counts = await readVehicleLayout(client, vehicleId);
  if (counts.layoutCount === 0) {
    throw invalidArgument('Cannot assign vehicle: configure its seat layout first');
  }
  if (counts.declaredCount !== counts.layoutCount) {
    throw invalidArgument('Cannot assign vehicle: seat_count does not match its seat layout');
  }
  return counts.layoutCount;
}

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
    `select rs.id, rs.route_id, rs.location_id, rs.stop_type, rs.stop_order,
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

async function fetchTripVehicleId(id) {
  const { rows } = await query('select vehicle_id from trips where id = $1', [id]);
  if (rows.length === 0) throw notFound('Trip not found');
  return rows[0].vehicle_id;
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
  const input = routeRequest(call.request);
  const { rows } = await query(
    `insert into routes (origin_location_id, destination_location_id, distance_km)
       values ($1, $2, $3) returning id`,
    [
      input.originLocationId,
      input.destinationLocationId,
      input.distanceKm || null,
    ],
  );
  return { route: await fetchRoute(rows[0].id) };
}

export async function updateRoute(call) {
  const id = validateAdminInput(() => requiredText(call.request.id, 'id'));
  const input = routeRequest(call.request);
  const { rowCount } = await query(
    `update routes set
        origin_location_id = $2,
        destination_location_id = $3,
        distance_km = $4
      where id = $1`,
    [
      id,
      input.originLocationId,
      input.destinationLocationId,
      input.distanceKm || null,
    ],
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
  const input = stopRequest(call.request);
  const { rows } = await query(
    `insert into route_stops (route_id, location_id, stop_type, stop_order)
       values ($1, $2, $3, $4) returning id`,
    [input.routeId, input.locationId, input.stopType, input.stopOrder],
  );
  return { stop: await fetchStop(rows[0].id) };
}

export async function updateStop(call) {
  const id = validateAdminInput(() => requiredText(call.request.id, 'id'));
  const input = stopRequest(call.request);
  const { rowCount } = await query(
    `update route_stops set
        route_id = $2,
        location_id = $3,
        stop_type = $4,
        stop_order = $5
      where id = $1`,
    [id, input.routeId, input.locationId, input.stopType, input.stopOrder],
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
  const input = vehicleRequest(call.request);
  const { rows } = await query(
    `insert into vehicles (operator_name, vehicle_code, license_plate, vehicle_type, seat_count)
       values ($1, $2, $3, $4, $5) returning id`,
    [
      input.operatorName,
      input.vehicleCode,
      input.licensePlate || null,
      input.vehicleType,
      input.seatCount,
    ],
  );
  return { vehicle: await fetchVehicle(rows[0].id) };
}

export async function updateVehicle(
  call,
  { database = pool, getVehicle = fetchVehicle } = {},
) {
  const id = validateAdminInput(() => requiredText(call.request.id, 'id'));
  const input = vehicleRequest(call.request);
  const client = await database.connect();
  try {
    await client.query('begin');
    await client.query(
      "select pg_advisory_xact_lock(hashtext('vehicle-layout'), hashtext($1))",
      [id],
    );
    const counts = await readVehicleLayout(client, id);
    if (counts.layoutCount > 0 && input.seatCount !== counts.layoutCount) {
      throw invalidArgument(
        'seat_count is derived from the configured layout and cannot diverge',
      );
    }
    await client.query(
      `update vehicles set
          operator_name = $2,
          vehicle_code = $3,
          license_plate = $4,
          vehicle_type = $5,
          seat_count = $6
        where id = $1`,
      [
        id,
        input.operatorName,
        input.vehicleCode,
        input.licensePlate || null,
        input.vehicleType,
        input.seatCount,
      ],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  return { vehicle: await getVehicle(id) };
}

export async function deleteVehicle(call) {
  const { id } = call.request;
  if (!id) throw invalidArgument('id is required');
  const { rowCount } = await query('delete from vehicles where id = $1', [id]);
  return { deleted: rowCount > 0 };
}

// Replaces the full seat layout for a vehicle in one transaction.
export async function configureVehicleSeats(call, { database = pool } = {}) {
  const vehicleId = validateAdminInput(
    () => requiredText(call.request.vehicle_id, 'vehicle_id'),
  );
  const list = validateAdminInput(() => normalizeVehicleSeatLayout(
    (call.request.seats || []).map((seat) => ({
      label: seat.label,
      deck: seat.deck,
      row: seat.row,
      column: seat.column,
    })),
  ));

  const client = await database.connect();
  try {
    await client.query('begin');
    await client.query(
      "select pg_advisory_xact_lock(hashtext('vehicle-layout'), hashtext($1))",
      [vehicleId],
    );
    const exists = await client.query('select 1 from vehicles where id = $1', [vehicleId]);
    if (exists.rowCount === 0) throw notFound('Vehicle not found');

    // A trip owns a materialized seat snapshot. Editing the source layout after
    // assignment would make vehicle_seats and trip_seats disagree.
    const assigned = await client.query(
      'select 1 from trips where vehicle_id = $1 limit 1',
      [vehicleId],
    );
    if (assigned.rowCount > 0) {
      throw invalidArgument('Cannot configure seats: vehicle is already assigned to a trip');
    }

    await client.query('delete from vehicle_seats where vehicle_id = $1', [vehicleId]);
    for (const seat of list) {
      await client.query(
        `insert into vehicle_seats (vehicle_id, seat_label, deck, seat_row, seat_column)
           values ($1, $2, $3, $4, $5)`,
        [vehicleId, seat.label, seat.deck, seat.row, seat.column],
      );
    }
    await client.query(
      'update vehicles set seat_count = $2 where id = $1',
      [vehicleId, list.length],
    );
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
    [vehicleId],
  );
  return { seats: rows.map(mapVehicleSeat) };
}

// ---- trips ------------------------------------------------------------------

async function recordTripStatusChange(
  client,
  tripId,
  previousStatus,
  nextStatus,
  writeOutbox = writeOutboxEvent,
) {
  if (previousStatus === nextStatus) return false;

  await client.query(
    `insert into event_logs (event_type, entity_type, entity_id, payload)
     values ($1, $2, $3, $4::jsonb)`,
    [
      'trip.status_changed',
      'trip',
      tripId,
      JSON.stringify({ previousStatus, status: nextStatus }),
    ],
  );

  if (nextStatus === 'COMPLETED') {
    await writeOutbox(client, {
      aggregateType: 'trip',
      aggregateId: tripId,
      eventName: 'trip.completed',
      target: 'RABBITMQ',
      routingKey: 'trip.completed',
      payload: { tripId },
    });
  }
  return true;
}

// Creates a trip and materializes its trip_seats from the vehicle layout.
export async function createTrip(
  call,
  { database = pool, getTrip = fetchTrip, writeEvent = logEvent } = {},
) {
  const input = tripRequest(call.request);
  const client = await database.connect();
  let tripId;
  try {
    await client.query('begin');
    // Serialize with configureVehicleSeats so the materialized trip_seats
    // snapshot always comes from one committed, non-empty vehicle layout.
    await client.query(
      "select pg_advisory_xact_lock(hashtext('vehicle-layout'), hashtext($1))",
      [input.vehicleId],
    );
    await requireRoute(client, input.routeId);
    await requireConfiguredVehicleLayout(client, input.vehicleId);
    const tripRes = await client.query(
      `insert into trips (route_id, vehicle_id, departure_time, arrival_time, price, status)
         values ($1, $2, $3, $4, $5, $6) returning id`,
      [
        input.routeId,
        input.vehicleId,
        input.departureTime,
        input.arrivalTime,
        input.price,
        input.status,
      ],
    );
    tripId = tripRes.rows[0].id;
    await client.query(
      `insert into trip_seats (trip_id, seat_label, status)
         select $1, seat_label, 'AVAILABLE' from vehicle_seats where vehicle_id = $2`,
      [tripId, input.vehicleId],
    );
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  await writeEvent('trip.created', 'trip', tripId, {
    route_id: input.routeId,
    vehicle_id: input.vehicleId,
    status: input.status,
  });
  return { trip: await getTrip(tripId) };
}

export async function updateTrip(
  call,
  {
    database = pool,
    seatMaintenance = withTripSeatMaintenance,
    getTrip = fetchTrip,
    getVehicleId = fetchTripVehicleId,
    writeEvent = logEvent,
  } = {},
) {
  const id = validateAdminInput(() => requiredText(call.request.id, 'id'));
  const input = tripRequest(call.request, { isUpdate: true });
  const requestedVehicleChange = input.vehicleId !== await getVehicleId(id);

  const executeUpdate = async ({ allowVehicleChange, refreshMaintenance }) => {
    const client = await database.connect();
    let vehicleChanging = false;
    try {
      await client.query('begin');
      // Schedule and vehicle changes affect cancellation/check-in decisions,
      // so they share the same lifecycle lock as status changes.
      await client.query(
        "select pg_advisory_xact_lock(hashtext('trip-lifecycle'), hashtext($1))",
        [id],
      );
      const current = await client.query(
        'select vehicle_id, status from trips where id = $1 for update',
        [id],
      );
      if (current.rowCount === 0) throw notFound('Trip not found');

      vehicleChanging = input.vehicleId !== current.rows[0].vehicle_id;
      if (vehicleChanging && !allowVehicleChange) {
        throw invalidArgument('Trip vehicle changed concurrently; retry the update');
      }

      await requireRoute(client, input.routeId);
      if (vehicleChanging) {
        await client.query("set local statement_timeout = '30s'");
        await client.query(
          "select pg_advisory_xact_lock(hashtext('vehicle-layout'), hashtext($1))",
          [input.vehicleId],
        );
        await requireConfiguredVehicleLayout(client, input.vehicleId);
        // Lock the whole materialized seat snapshot. Confirm/block operations
        // either commit first and are observed here, or wait until this update
        // commits and then fail against the replacement snapshot.
        const seatRows = await client.query(
          'select status from trip_seats where trip_id = $1 for update',
          [id],
        );
        if (seatRows.rows.some((seat) => seat.status !== 'AVAILABLE')) {
          throw invalidArgument('Cannot change vehicle: trip already has booked or blocked seats');
        }
      }

      await client.query(
        `update trips set
            route_id = $2,
            vehicle_id = $3,
            departure_time = $4,
            arrival_time = $5,
            price = $6
          where id = $1`,
        [
          id,
          input.routeId,
          input.vehicleId,
          input.departureTime,
          input.arrivalTime,
          input.price,
        ],
      );

      if (vehicleChanging) {
        await client.query('delete from trip_seats where trip_id = $1', [id]);
        await client.query(
          `insert into trip_seats (trip_id, seat_label, status)
             select $1, seat_label, 'AVAILABLE' from vehicle_seats where vehicle_id = $2`,
          [id, input.vehicleId],
        );
        await refreshMaintenance();
      }
      await client.query('commit');
      return vehicleChanging;
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  };

  let vehicleChanging;
  if (requestedVehicleChange) {
    const maintenance = await seatMaintenance(
      id,
      (refreshMaintenance) => executeUpdate({
        allowVehicleChange: true,
        refreshMaintenance,
      }),
    );
    if (!maintenance.acquired) {
      throw invalidArgument('Cannot change vehicle: trip seat layout is already being updated');
    }
    if (maintenance.hasActiveHolds) {
      throw invalidArgument('Cannot change vehicle: trip has active seat holds');
    }
    vehicleChanging = maintenance.value;
  } else {
    vehicleChanging = await executeUpdate({
      allowVehicleChange: false,
      refreshMaintenance: null,
    });
  }

  if (vehicleChanging) {
    await writeEvent('trip.vehicle_changed', 'trip', id, {
      vehicle_id: input.vehicleId,
    });
  }

  return { trip: await getTrip(id) };
}

export async function deleteTrip(
  call,
  {
    database = pool,
    seatMaintenance = withTripSeatMaintenance,
  } = {},
) {
  const { id } = call.request;
  if (!id) throw invalidArgument('id is required');

  const maintenance = await seatMaintenance(id, async (refreshMaintenance) => {
    const client = await database.connect();
    try {
      await client.query('begin');
      await client.query("set local statement_timeout = '30s'");
      // Serialize against Booking Service createBooking. Without a physical
      // cross-service FK, this application-level lock plus reference check is
      // what prevents a booking from being committed for a deleted trip.
      await client.query(
        "select pg_advisory_xact_lock(hashtext('trip-lifecycle'), hashtext($1))",
        [id],
      );
      const referenced = await client.query(
        'select 1 from bookings where trip_id = $1 limit 1',
        [id],
      );
      if (referenced.rowCount > 0) {
        throw invalidArgument('Cannot delete trip: existing bookings reference it');
      }

      // trip_seats belongs to the Seat Inventory boundary, so there is no
      // cross-service FK cascade. Redis maintenance blocks new holds and the
      // pre-work scan rejected existing holds before projection cleanup.
      await client.query('delete from trip_seats where trip_id = $1', [id]);
      const { rowCount } = await client.query('delete from trips where id = $1', [id]);
      await refreshMaintenance();
      await client.query('commit');
      return { deleted: rowCount > 0 };
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  });

  if (!maintenance.acquired) {
    throw invalidArgument('Cannot delete trip: seat topology is already being updated');
  }
  if (maintenance.hasActiveHolds) {
    throw invalidArgument('Cannot delete trip: trip has active seat holds');
  }
  return maintenance.value;
}

export async function updateTripStatus(
  call,
  {
    database = pool,
    getTrip = fetchTrip,
    writeOutbox = writeOutboxEvent,
  } = {},
) {
  const { trip_id, status } = call.request;
  if (!trip_id) throw invalidArgument('trip_id is required');

  const client = await database.connect();
  try {
    await client.query('begin');
    await client.query(
      "select pg_advisory_xact_lock(hashtext('trip-lifecycle'), hashtext($1))",
      [trip_id],
    );
    const current = await client.query(
      'select status from trips where id = $1 for update',
      [trip_id],
    );
    if (current.rowCount === 0) throw notFound('Trip not found');

    validateAdminInput(() => assertTripStatusTransition(
      current.rows[0].status,
      status,
    ));

    if (current.rows[0].status !== status) {
      await client.query(
        'update trips set status = $2 where id = $1',
        [trip_id, status],
      );
      await recordTripStatusChange(
        client,
        trip_id,
        current.rows[0].status,
        status,
        writeOutbox,
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return { trip: await getTrip(trip_id) };
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

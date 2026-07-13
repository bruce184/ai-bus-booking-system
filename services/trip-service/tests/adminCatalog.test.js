import assert from "node:assert/strict";
import test from "node:test";

import {
  configureVehicleSeats,
  createTrip,
  deleteTrip,
  updateTrip
} from "../src/service/adminCatalog.js";

test("trip deletion explicitly cleans the seat projection without an FK cascade", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("select pg_advisory_xact_lock")) return { rowCount: 1, rows: [] };
      if (sql.startsWith("select 1 from bookings")) return { rowCount: 0, rows: [] };
      return { rowCount: sql.startsWith("delete from trips") ? 1 : 0, rows: [] };
    },
    release() {
      statements.push("release");
    }
  };

  const result = await deleteTrip(
    { request: { id: "trip-1" } },
    {
        database: { connect: async () => client },
        seatMaintenance: async (_tripId, work) => ({
          acquired: true,
          hasActiveHolds: false,
          value: await work(async () => {})
        })
      }
  );

  assert.deepEqual(result, { deleted: true });
  assert.deepEqual(statements, [
    "begin",
    "set local statement_timeout = '30s'",
    "select pg_advisory_xact_lock(hashtext('trip-lifecycle'), hashtext($1))",
    "select 1 from bookings where trip_id = $1 limit 1",
    "delete from trip_seats where trip_id = $1",
    "delete from trips where id = $1",
    "commit",
    "release"
  ]);
});

test("trip deletion rejects logical booking references before deleting projections", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("select 1 from bookings")) return { rowCount: 1, rows: [{ "?column?": 1 }] };
      return { rowCount: 1, rows: [] };
    },
    release() {
      statements.push("release");
    }
  };

  await assert.rejects(
    deleteTrip(
      { request: { id: "trip-with-booking" } },
      {
        database: { connect: async () => client },
        seatMaintenance: async (_tripId, work) => ({
          acquired: true,
          hasActiveHolds: false,
          value: await work(async () => {})
        })
      }
    ),
    /Cannot delete trip: existing bookings reference it/
  );

  assert.deepEqual(statements, [
    "begin",
    "set local statement_timeout = '30s'",
    "select pg_advisory_xact_lock(hashtext('trip-lifecycle'), hashtext($1))",
    "select 1 from bookings where trip_id = $1 limit 1",
    "rollback",
    "release"
  ]);
  assert.equal(statements.some((sql) => sql.startsWith("delete from trip_seats")), false);
  assert.equal(statements.some((sql) => sql.startsWith("delete from trips")), false);
});


test("trip deletion rejects active Redis holds before opening a database transaction", async () => {
  let connected = false;

  await assert.rejects(
    deleteTrip(
      { request: { id: "trip-with-hold" } },
      {
        database: {
          connect: async () => {
            connected = true;
            throw new Error("database must not open while a hold is active");
          }
        },
        seatMaintenance: async () => ({
          acquired: true,
          hasActiveHolds: true
        })
      }
    ),
    /trip has active seat holds/
  );

  assert.equal(connected, false);
});

test("vehicle layout cannot change after assignment to a trip", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("select 1 from vehicles")) return { rowCount: 1, rows: [{ "?column?": 1 }] };
      if (sql.startsWith("select 1 from trips")) return { rowCount: 1, rows: [{ "?column?": 1 }] };
      return { rowCount: 0, rows: [] };
    },
    release() {
      statements.push("release");
    }
  };

  await assert.rejects(
    configureVehicleSeats(
      { request: { vehicle_id: "vehicle-1", seats: [{ label: "A1" }] } },
      { database: { connect: async () => client } }
    ),
    /vehicle is already assigned to a trip/
  );

  assert.deepEqual(statements, [
    "begin",
    "select pg_advisory_xact_lock(hashtext('vehicle-layout'), hashtext($1))",
    "select 1 from vehicles where id = $1",
    "select 1 from trips where vehicle_id = $1 limit 1",
    "rollback",
    "release"
  ]);
});

test("trip creation snapshots a vehicle layout under the shared layout lock", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("insert into trips")) return { rowCount: 1, rows: [{ id: "trip-new" }] };
      return { rowCount: 1, rows: [] };
    },
    release() {
      statements.push("release");
    }
  };
  const events = [];

  const result = await createTrip(
    {
      request: {
        route_id: "route-1",
        vehicle_id: "vehicle-1",
        departure_time: "2026-07-20T01:00:00Z",
        arrival_time: "2026-07-20T03:00:00Z",
        price: 100000,
        status: "ACTIVE"
      }
    },
    {
      database: { connect: async () => client },
      getTrip: async (id) => ({ id }),
      writeEvent: async (...args) => events.push(args)
    }
  );

  assert.deepEqual(result, { trip: { id: "trip-new" } });
  assert.deepEqual(statements, [
    "begin",
    "select pg_advisory_xact_lock(hashtext('vehicle-layout'), hashtext($1))",
    "insert into trips (route_id, vehicle_id, departure_time, arrival_time, price, status) values ($1, $2, $3, $4, $5, $6) returning id",
    "insert into trip_seats (trip_id, seat_label, status) select $1, seat_label, 'available' from vehicle_seats where vehicle_id = $2",
    "commit",
    "release"
  ]);
  assert.equal(events.length, 1);
});

test("vehicle change is rejected before database mutation when Redis reports active holds", async () => {
  let connected = false;

  await assert.rejects(
    updateTrip(
      { request: { id: "trip-1", vehicle_id: "vehicle-new" } },
      {
        database: { connect: async () => {
          connected = true;
          throw new Error("database should not be opened");
        } },
        getVehicleId: async () => "vehicle-old",
        seatMaintenance: async () => ({
          acquired: true,
          hasActiveHolds: true
        })
      }
    ),
    /trip has active seat holds/
  );

  assert.equal(connected, false);
});

test("vehicle change keeps Redis maintenance locked through the committed snapshot rebuild", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("select vehicle_id")) {
        return { rowCount: 1, rows: [{ vehicle_id: "vehicle-old" }] };
      }
      if (sql.startsWith("select status from trip_seats")) {
        return { rowCount: 2, rows: [{ status: "AVAILABLE" }, { status: "AVAILABLE" }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {
      statements.push("release");
    }
  };
  const maintenancePhases = [];

  const result = await updateTrip(
    { request: { id: "trip-1", vehicle_id: "vehicle-new" } },
    {
      database: { connect: async () => client },
      getVehicleId: async () => "vehicle-old",
      getTrip: async (id) => ({ id, vehicleId: "vehicle-new" }),
      writeEvent: async () => {},
      seatMaintenance: async (_tripId, work) => {
        maintenancePhases.push("locked");
        const value = await work(async () => {
          maintenancePhases.push("renewed");
        });
        maintenancePhases.push("after-commit");
        return { acquired: true, hasActiveHolds: false, value };
      }
    }
  );

  assert.deepEqual(result, { trip: { id: "trip-1", vehicleId: "vehicle-new" } });
  assert.deepEqual(maintenancePhases, ["locked", "renewed", "after-commit"]);
  assert.deepEqual(statements, [
    "begin",
    "select vehicle_id from trips where id = $1 for update",
    "set local statement_timeout = '30s'",
    "select pg_advisory_xact_lock(hashtext('vehicle-layout'), hashtext($1))",
    "select status from trip_seats where trip_id = $1 for update",
    "update trips set route_id = coalesce($2, route_id), vehicle_id = coalesce($3, vehicle_id), departure_time = coalesce($4, departure_time), arrival_time = coalesce($5, arrival_time), price = coalesce($6, price), status = coalesce($7, status) where id = $1",
    "delete from trip_seats where trip_id = $1",
    "insert into trip_seats (trip_id, seat_label, status) select $1, seat_label, 'available' from vehicle_seats where vehicle_id = $2",
    "commit",
    "release"
  ]);
});

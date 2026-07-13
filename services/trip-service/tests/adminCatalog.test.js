import assert from "node:assert/strict";
import test from "node:test";

import {
  configureVehicleSeats,
  createTrip,
  deleteTrip,
  updateTrip,
  updateTripStatus,
  updateVehicle
} from "../src/service/adminCatalog.js";

function tripUpdateRequest(overrides = {}) {
  return {
    id: "trip-1",
    route_id: "route-1",
    vehicle_id: "vehicle-1",
    departure_time: "2026-07-20T01:00:00Z",
    arrival_time: "2026-07-20T03:00:00Z",
    price: 100000,
    status: "TRIP_STATUS_UNSPECIFIED",
    ...overrides
  };
}

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
      {
        request: {
          vehicle_id: "vehicle-1",
          seats: [{ label: "A1", deck: 1, row: 1, column: 1 }]
        }
      },
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
      if (sql.startsWith("select seat_count from vehicles")) {
        return { rowCount: 1, rows: [{ seat_count: 2 }] };
      }
      if (sql.startsWith("select count(*)")) {
        return { rowCount: 1, rows: [{ seat_count: 2 }] };
      }
      if (sql.startsWith("insert into trips")) {
        return { rowCount: 1, rows: [{ id: "trip-new" }] };
      }
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
    "select 1 from routes where id = $1",
    "select seat_count from vehicles where id = $1",
    "select count(*)::int as seat_count from vehicle_seats where vehicle_id = $1",
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
      { request: tripUpdateRequest({ vehicle_id: "vehicle-new" }) },
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
      if (sql.startsWith("select seat_count from vehicles")) {
        return { rowCount: 1, rows: [{ seat_count: 2 }] };
      }
      if (sql.startsWith("select count(*)")) {
        return { rowCount: 1, rows: [{ seat_count: 2 }] };
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
    { request: tripUpdateRequest({ vehicle_id: "vehicle-new" }) },
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
    "select pg_advisory_xact_lock(hashtext('trip-lifecycle'), hashtext($1))",
    "select vehicle_id, status from trips where id = $1 for update",
    "select 1 from routes where id = $1",
    "set local statement_timeout = '30s'",
    "select pg_advisory_xact_lock(hashtext('vehicle-layout'), hashtext($1))",
    "select seat_count from vehicles where id = $1",
    "select count(*)::int as seat_count from vehicle_seats where vehicle_id = $1",
    "select status from trip_seats where trip_id = $1 for update",
    "update trips set route_id = $2, vehicle_id = $3, departure_time = $4, arrival_time = $5, price = $6 where id = $1",
    "delete from trip_seats where trip_id = $1",
    "insert into trip_seats (trip_id, seat_label, status) select $1, seat_label, 'available' from vehicle_seats where vehicle_id = $2",
    "commit",
    "release"
  ]);
});


test("dedicated trip completion writes one transactional trip.completed outbox event", async () => {
  const statements = [];
  const outbox = [];
  let status = "DEPARTED";
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("select status from trips")) {
        return { rowCount: 1, rows: [{ status }] };
      }
      if (sql.startsWith("update trips set status")) {
        status = "COMPLETED";
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {
      statements.push("release");
    }
  };

  const result = await updateTripStatus(
    { request: { trip_id: "trip-1", status: "COMPLETED" } },
    {
      database: { connect: async () => client },
      getTrip: async (id) => ({ id, status }),
      writeOutbox: async (_client, event) => outbox.push(event)
    }
  );

  assert.deepEqual(result, { trip: { id: "trip-1", status: "COMPLETED" } });
  assert.equal(statements[0], "begin");
  assert.match(statements[1], /pg_advisory_xact_lock.*trip-lifecycle/);
  assert.equal(statements[2], "select status from trips where id = $1 for update");
  assert.equal(statements[3], "update trips set status = $2 where id = $1");
  assert.ok(statements[4].startsWith("insert into event_logs"));
  assert.equal(statements[5], "commit");
  assert.equal(statements[6], "release");
  assert.deepEqual(outbox, [{
    aggregateType: "trip",
    aggregateId: "trip-1",
    eventName: "trip.completed",
    target: "RABBITMQ",
    routingKey: "trip.completed",
    payload: { tripId: "trip-1" }
  }]);
});

test("repeating COMPLETED is idempotent and emits no duplicate completion event", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("select status from trips")) {
        return { rowCount: 1, rows: [{ status: "COMPLETED" }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {}
  };

  let outboxWrites = 0;
  await updateTripStatus(
    { request: { trip_id: "trip-1", status: "COMPLETED" } },
    {
      database: { connect: async () => client },
      getTrip: async (id) => ({ id, status: "COMPLETED" }),
      writeOutbox: async () => {
        outboxWrites += 1;
      }
    }
  );

  assert.equal(outboxWrites, 0);
  assert.equal(statements.some((sql) => sql.startsWith("update trips set status")), false);
  assert.equal(statements.some((sql) => sql.startsWith("insert into event_logs")), false);
});

test("generic trip update rejects status changes before opening a transaction", async () => {
  let connected = false;

  await assert.rejects(
    updateTrip(
      {
        request: tripUpdateRequest({
          status: "COMPLETED"
        })
      },
      {
        database: {
          connect: async () => {
            connected = true;
            throw new Error("must not connect");
          }
        },
        getVehicleId: async () => "vehicle-1"
      }
    ),
    /adminUpdateTripStatus/
  );

  assert.equal(connected, false);
});

test("invalid trip status jumps roll back without an event", async () => {
  const statements = [];
  let outboxWrites = 0;
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("select status from trips")) {
        return { rowCount: 1, rows: [{ status: "DRAFT" }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {
      statements.push("release");
    }
  };

  await assert.rejects(
    updateTripStatus(
      { request: { trip_id: "trip-1", status: "COMPLETED" } },
      {
        database: { connect: async () => client },
        writeOutbox: async () => {
          outboxWrites += 1;
        }
      }
    ),
    /Invalid trip status transition: DRAFT -> COMPLETED/
  );

  assert.equal(outboxWrites, 0);
  assert.equal(
    statements.some((sql) => sql.startsWith("update trips set status")),
    false
  );
  assert.equal(statements.at(-2), "rollback");
  assert.equal(statements.at(-1), "release");
});

test("trip creation rejects an unconfigured vehicle before inserting a trip", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("select seat_count from vehicles")) {
        return { rowCount: 1, rows: [{ seat_count: 29 }] };
      }
      if (sql.startsWith("select count(*)")) {
        return { rowCount: 1, rows: [{ seat_count: 0 }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {
      statements.push("release");
    }
  };

  await assert.rejects(
    createTrip(
      {
        request: {
          route_id: "route-1",
          vehicle_id: "vehicle-empty",
          departure_time: "2026-07-20T01:00:00Z",
          arrival_time: "2026-07-20T03:00:00Z",
          price: 100000,
          status: "DRAFT"
        }
      },
      { database: { connect: async () => client } }
    ),
    /configure its seat layout first/
  );

  assert.equal(
    statements.some((sql) => sql.startsWith("insert into trips")),
    false
  );
  assert.equal(statements.at(-2), "rollback");
  assert.equal(statements.at(-1), "release");
});

test("vehicle metadata cannot diverge from an existing seat layout", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("select seat_count from vehicles")) {
        return { rowCount: 1, rows: [{ seat_count: 29 }] };
      }
      if (sql.startsWith("select count(*)")) {
        return { rowCount: 1, rows: [{ seat_count: 29 }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {
      statements.push("release");
    }
  };

  await assert.rejects(
    updateVehicle(
      {
        request: {
          id: "vehicle-1",
          operator_name: "Demo",
          vehicle_code: "V01",
          license_plate: "",
          vehicle_type: "seat_29",
          seat_count: 30
        }
      },
      { database: { connect: async () => client } }
    ),
    /cannot diverge/
  );

  assert.equal(
    statements.some((sql) => sql.startsWith("update vehicles")),
    false
  );
  assert.equal(statements.at(-2), "rollback");
  assert.equal(statements.at(-1), "release");
});

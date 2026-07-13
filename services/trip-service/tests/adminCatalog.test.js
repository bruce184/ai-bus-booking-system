import assert from "node:assert/strict";
import test from "node:test";

import { deleteTrip } from "../src/service/adminCatalog.js";

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
    { database: { connect: async () => client } }
  );

  assert.deepEqual(result, { deleted: true });
  assert.deepEqual(statements, [
    "begin",
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
      { database: { connect: async () => client } }
    ),
    /Cannot delete trip: existing bookings reference it/
  );

  assert.deepEqual(statements, [
    "begin",
    "select pg_advisory_xact_lock(hashtext('trip-lifecycle'), hashtext($1))",
    "select 1 from bookings where trip_id = $1 limit 1",
    "rollback",
    "release"
  ]);
  assert.equal(statements.some((sql) => sql.startsWith("delete from trip_seats")), false);
  assert.equal(statements.some((sql) => sql.startsWith("delete from trips")), false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { deleteTrip } from "../src/service/adminCatalog.js";

test("trip deletion explicitly cleans the seat projection without an FK cascade", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
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
    "delete from trip_seats where trip_id = $1",
    "delete from trips where id = $1",
    "commit",
    "release"
  ]);
});

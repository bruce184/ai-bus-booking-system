import assert from "node:assert/strict";
import test from "node:test";

import {
  blockTripSeats,
  confirmTripSeats
} from "../src/repositories/seatRepository.js";

const tripId = "00000000-0000-4000-8000-000000000010";
const bookingId = "00000000-0000-4000-8000-000000000020";
const otherBookingId = "00000000-0000-4000-8000-000000000030";

function fakeDatabase(initialRows) {
  const rows = initialRows.map((row) => ({
    booking_id: null,
    block_reason: null,
    ...row
  }));
  const statements = [];
  const client = {
    async query(text, params = []) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);

      if (["begin", "commit", "rollback"].includes(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.startsWith("select id, seat_label, status, booking_id")) {
        return { rows: rows.map((row) => ({ ...row })) };
      }
      if (sql.startsWith("update trip_seats") && sql.includes("set status = 'booked'")) {
        for (const row of rows) {
          row.status = "BOOKED";
          row.booking_id = params[2];
          row.block_reason = null;
        }
        return { rows: [], rowCount: rows.length };
      }
      if (sql.startsWith("update trip_seats") && sql.includes("set status = 'blocked'")) {
        for (const row of rows) {
          row.status = "BLOCKED";
          row.booking_id = null;
          row.block_reason = params[2];
        }
        return { rows: [], rowCount: rows.length };
      }
      if (sql.includes("from trip_seats ts")) {
        return {
          rows: rows.map((row, index) => ({
            id: `seat-row-${index + 1}`,
            seat_label: row.seat_label,
            deck: 1,
            seat_row: 1,
            seat_column: index + 1,
            status: row.status,
            block_reason: row.block_reason
          }))
        };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
    release() {}
  };

  return {
    statements,
    async connect() {
      return client;
    }
  };
}

test("confirm rejects the whole set before update when one seat belongs to another booking", async () => {
  const database = fakeDatabase([
    { seat_label: "A01", status: "AVAILABLE" },
    { seat_label: "A02", status: "BOOKED", booking_id: otherBookingId }
  ]);
  let validations = 0;

  const result = await confirmTripSeats(
    tripId,
    ["A01", "A02"],
    bookingId,
    async () => {
      validations += 1;
    },
    database
  );

  assert.equal(result.outcome, "UNAVAILABLE");
  assert.equal(result.seatId, "A02");
  assert.equal(validations, 0);
  assert.equal(database.statements.some((sql) => sql.startsWith("update trip_seats")), false);
});

test("confirm updates every requested seat in one locked transaction", async () => {
  const database = fakeDatabase([
    { seat_label: "A01", status: "AVAILABLE" },
    { seat_label: "A02", status: "AVAILABLE" }
  ]);
  let validations = 0;

  const result = await confirmTripSeats(
    tripId,
    ["A01", "A02"],
    bookingId,
    async () => {
      validations += 1;
    },
    database
  );

  assert.equal(result.outcome, "CONFIRMED");
  assert.equal(result.alreadyConfirmed, false);
  assert.deepEqual(result.seats.map((seat) => seat.status), ["BOOKED", "BOOKED"]);
  assert.equal(validations, 1);
  assert.equal(database.statements[0], "begin");
  assert.equal(database.statements.at(-1), "commit");
});

test("confirm retry for the same booking succeeds without requiring an expired hold", async () => {
  const database = fakeDatabase([
    { seat_label: "A01", status: "BOOKED", booking_id: bookingId },
    { seat_label: "A02", status: "BOOKED", booking_id: bookingId }
  ]);
  let validations = 0;

  const result = await confirmTripSeats(
    tripId,
    ["A01", "A02"],
    bookingId,
    async () => {
      validations += 1;
    },
    database
  );

  assert.equal(result.outcome, "CONFIRMED");
  assert.equal(result.alreadyConfirmed, true);
  assert.equal(validations, 0);
  assert.equal(database.statements.some((sql) => sql.startsWith("update trip_seats")), false);
});

test("confirm rolls back without an update when hold validation fails", async () => {
  const database = fakeDatabase([
    { seat_label: "A01", status: "AVAILABLE" },
    { seat_label: "A02", status: "AVAILABLE" }
  ]);

  await assert.rejects(
    confirmTripSeats(
      tripId,
      ["A01", "A02"],
      bookingId,
      async () => {
        throw new Error("hold expired");
      },
      database
    ),
    /hold expired/
  );

  assert.equal(database.statements.some((sql) => sql.startsWith("update trip_seats")), false);
  assert.equal(database.statements.at(-1), "rollback");
});

test("block rejects the whole set before update when any requested seat is booked", async () => {
  const database = fakeDatabase([
    { seat_label: "A01", status: "AVAILABLE" },
    { seat_label: "A02", status: "BOOKED", booking_id: bookingId }
  ]);

  const result = await blockTripSeats(tripId, ["A01", "A02"], "maintenance", database);

  assert.equal(result.outcome, "UNAVAILABLE");
  assert.equal(result.seatId, "A02");
  assert.equal(database.statements.some((sql) => sql.startsWith("update trip_seats")), false);
});

test("block reports a missing seat without partially updating existing seats", async () => {
  const database = fakeDatabase([{ seat_label: "A01", status: "AVAILABLE" }]);

  const result = await blockTripSeats(tripId, ["A01", "A02"], "maintenance", database);

  assert.equal(result.outcome, "MISSING");
  assert.equal(result.seatId, "A02");
  assert.equal(database.statements.some((sql) => sql.startsWith("update trip_seats")), false);
});

test("block updates the complete requested set in one transaction", async () => {
  const database = fakeDatabase([
    { seat_label: "A01", status: "AVAILABLE" },
    { seat_label: "A02", status: "AVAILABLE" }
  ]);

  const result = await blockTripSeats(tripId, ["A01", "A02"], "maintenance", database);

  assert.equal(result.outcome, "BLOCKED");
  assert.deepEqual(result.seats.map((seat) => seat.status), ["BLOCKED", "BLOCKED"]);
  assert.deepEqual(result.seats.map((seat) => seat.blockReason), ["maintenance", "maintenance"]);
  assert.equal(database.statements[0], "begin");
  assert.equal(database.statements.at(-1), "commit");
});

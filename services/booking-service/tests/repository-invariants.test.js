import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingCode,
  bookingRequestMatches,
  cancelBooking,
  checkInPassenger,
  createBooking,
  isPaymentSettledStatus,
  settleBookingPayment
} from "../src/repository.js";

test("booking codes use the Asia/Ho_Chi_Minh business date", () => {
  const afterLocalMidnight = new Date("2026-07-13T17:30:00.000Z");
  assert.match(bookingCode(afterLocalMidnight), /^BK20260714\d{6}$/);
});

test("cancellation reads departure policy through Trip Service, without joining trips", async () => {
  const statements = [];
  const runQuery = async (text) => {
    statements.push(text.replace(/\s+/g, " ").trim().toLowerCase());
    return { rows: [{ id: storedBooking().id, trip_id: input.trip_id, status: "PAID" }] };
  };

  await assert.rejects(
    cancelBooking(
      { booking_code: storedBooking().booking_code, email: storedBooking().contact_email },
      {
        runQuery,
        runTransaction: async () => assert.fail("transaction must not start when policy rejects"),
        getTripSnapshot: async () => ({
          departureTime: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString()
        })
      }
    ),
    (error) => error.code === "BOOKING_STATE_INVALID"
  );

  assert.equal(statements.some((sql) => sql.includes("join trips")), false);
});

test("check-in reads trip status through Trip Service, without joining trips", async () => {
  const statements = [];
  const runQuery = async (text) => {
    statements.push(text.replace(/\s+/g, " ").trim().toLowerCase());
    return { rows: [{ id: storedBooking().id, trip_id: input.trip_id, status: "TICKET_ISSUED" }] };
  };

  await assert.rejects(
    checkInPassenger(
      { code: storedBooking().booking_code, staff_user_id: "staff-1" },
      {
        runQuery,
        runTransaction: async () => assert.fail("transaction must not start for a cancelled trip"),
        getTripSnapshot: async () => ({ status: "CANCELLED" })
      }
    ),
    (error) => error.code === "BOOKING_STATE_INVALID"
  );

  assert.equal(statements.some((sql) => sql.includes("join trips")), false);
});

test("cancellation queues both analytics and seat-release recovery events", async () => {
  let status = "PAID";
  const outboxTargets = [];
  const client = {
    async query(text, params = []) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      if (sql.startsWith("select * from bookings") && sql.includes("for update")) {
        return { rows: [{ ...storedBooking(status), status }] };
      }
      if (sql.startsWith("update bookings set status = 'cancelled'")) {
        status = "CANCELLED";
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("insert into event_logs")) return { rowCount: 1, rows: [] };
      if (sql.startsWith("insert into outbox_events")) {
        outboxTargets.push({ target: params[3], routingKey: params[4], eventId: params[6] });
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("select seat_label from booking_passengers")) {
        return { rows: [{ seat_label: "A01" }, { seat_label: "A02" }] };
      }
      if (sql === "select * from bookings where id = $1") {
        return { rows: [{ ...storedBooking(status), status }] };
      }
      if (sql.startsWith("select * from booking_passengers")) {
        return { rows: storedPassengers() };
      }
      if (sql.includes("from tickets tk")) return { rows: [] };
      throw new Error(`Unexpected SQL in cancellation test: ${sql}`);
    }
  };

  const result = await cancelBooking(
    { booking_code: storedBooking().booking_code, email: storedBooking().contact_email },
    {
      runQuery: async () => ({
        rows: [{ id: storedBooking().id, trip_id: input.trip_id, status: "PAID" }]
      }),
      runTransaction: (work) => work(client),
      getTripSnapshot: async () => ({
        departureTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      })
    }
  );

  assert.equal(result.status, "CANCELLED");
  assert.equal(outboxTargets[0].target, "KAFKA");
  assert.equal(outboxTargets[0].routingKey, "booking-events");
  assert.equal(outboxTargets[1].target, "RABBITMQ");
  assert.equal(outboxTargets[1].routingKey, "booking.cancelled");
  assert.equal(outboxTargets[0].eventId, outboxTargets[1].eventId);
});

const input = {
  trip_id: "trip-1",
  hold_token: "hold-1",
  contact_email: "Guest@Example.com",
  contact_phone: "0900000000",
  passengers: [
    { full_name: "Passenger B", seat_id: "A02", email: "guest@example.com" },
    { full_name: "Passenger A", seat_id: "A01", email: "guest@example.com" }
  ]
};

function storedBooking(status = "PENDING_PAYMENT") {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    booking_code: "BK202607110001",
    customer_user_id: null,
    trip_id: input.trip_id,
    hold_token: input.hold_token,
    contact_email: "guest@example.com",
    contact_phone: input.contact_phone,
    status,
    total_amount: 560000
  };
}

function storedPassengers() {
  return input.passengers.map((passenger) => ({
    full_name: passenger.full_name,
    phone: null,
    email: passenger.email,
    document_number: null,
    seat_label: passenger.seat_id
  }));
}

function repositoryClient(initialStatus = "PENDING_PAYMENT") {
  let status = initialStatus;
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);

      if (sql.includes("pg_advisory_xact_lock")) {
        return { rows: [] };
      }
      if (sql.startsWith("select id from bookings where hold_token")) {
        return { rows: [{ id: storedBooking().id }] };
      }
      if (sql.startsWith("select id from bookings") && sql.includes("booking_code")) {
        return { rows: [{ id: storedBooking().id }] };
      }
      if (sql === "select * from bookings where id = $1") {
        return { rows: [{ ...storedBooking(status), status }] };
      }
      if (sql.startsWith("select * from booking_passengers")) {
        return { rows: storedPassengers() };
      }
      if (sql.includes("from tickets tk")) {
        return { rows: [] };
      }
      if (sql.startsWith("update bookings") && sql.includes("set status = 'paid'")) {
        status = "PAID";
        return { rows: [{ id: storedBooking().id }], rowCount: 1 };
      }
      if (sql.startsWith("insert into event_logs")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("insert into outbox_events")) {
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    }
  };

  return { client, statements };
}

test("booking request matching is order-insensitive but binds every passenger field", () => {
  const booking = {
    ...storedBooking(),
    customer_user_id: "",
    passengers: storedPassengers().map((row) => ({
      full_name: row.full_name,
      phone: "",
      email: row.email,
      document_number: "",
      seat_id: row.seat_label
    }))
  };

  assert.equal(bookingRequestMatches(booking, input), true);
  assert.equal(
    bookingRequestMatches(booking, {
      ...input,
      passengers: [{ ...input.passengers[0], seat_id: "A03" }, input.passengers[1]]
    }),
    false
  );
});

const activeTripSnapshot = async () => ({ price: 280000, status: "ACTIVE" });

test("same hold token returns the existing booking without inserting another row", async () => {
  const { client, statements } = repositoryClient();
  const result = await createBooking(input, {
    runTransaction: (work) => work(client),
    getTripSnapshot: activeTripSnapshot
  });

  assert.equal(result.created, false);
  assert.equal(result.booking.booking_code, storedBooking().booking_code);
  assert.equal(statements.some((sql) => sql.startsWith("insert into bookings")), false);
  assert.equal(statements.some((sql) => sql.includes("pg_advisory_xact_lock")), true);
});

test("same hold token rejects a different logical booking request", async () => {
  const { client } = repositoryClient();

  await assert.rejects(
    createBooking(
      { ...input, contact_email: "other@example.com" },
      { runTransaction: (work) => work(client), getTripSnapshot: activeTripSnapshot }
    ),
    (error) => error.code === "BOOKING_STATE_INVALID"
  );
});

test("createBooking rejects when Trip Service reports the trip is not ACTIVE", async () => {
  const { client } = repositoryClient();

  await assert.rejects(
    createBooking(input, {
      runTransaction: (work) => work(client),
      getTripSnapshot: async () => ({ price: 280000, status: "LOCKED" })
    }),
    (error) => error.code === "BOOKING_STATE_INVALID"
  );
});

test("createBooking propagates a trip lookup failure without touching the database", async () => {
  const { client, statements } = repositoryClient();

  await assert.rejects(
    createBooking(input, {
      runTransaction: (work) => work(client),
      getTripSnapshot: async () => {
        const notFound = new Error("Trip not found");
        notFound.code = "NOT_FOUND";
        throw notFound;
      }
    }),
    (error) => error.code === "NOT_FOUND"
  );
  assert.equal(statements.length, 0);
});

test("settled payment retry is idempotent and does not process payment again", async () => {
  const { client } = repositoryClient("PAID");
  let calls = 0;
  const result = await settleBookingPayment(
    {
      bookingCode: storedBooking().booking_code,
      email: storedBooking().contact_email,
      success: true,
      processPayment: async () => {
        calls += 1;
      }
    },
    { runTransaction: (work) => work(client) }
  );

  assert.equal(result.transitioned, false);
  assert.equal(result.booking.status, "PAID");
  assert.equal(calls, 0);
});

test("pending payment is processed once while the booking row is locked", async () => {
  const { client, statements } = repositoryClient();
  let calls = 0;
  const result = await settleBookingPayment(
    {
      bookingCode: storedBooking().booking_code,
      email: storedBooking().contact_email,
      success: true,
      processPayment: async () => {
        calls += 1;
      }
    },
    { runTransaction: (work) => work(client) }
  );

  assert.equal(result.transitioned, true);
  assert.equal(result.booking.status, "PAID");
  assert.equal(calls, 1);
  assert.equal(statements[0].includes("for no key update"), true);
});

test("failed payment processing does not mark the locked booking paid", async () => {
  const { client, statements } = repositoryClient();

  await assert.rejects(
    settleBookingPayment(
      {
        bookingCode: storedBooking().booking_code,
        email: storedBooking().contact_email,
        success: true,
        processPayment: async () => {
          throw new Error("seat confirmation failed");
        }
      },
      { runTransaction: (work) => work(client) }
    ),
    /seat confirmation failed/
  );

  assert.equal(
    statements.some((sql) => sql.startsWith("update bookings") && sql.includes("set status = 'paid'")),
    false
  );
});

test("settlement rejects a booking code and email that don't match", async () => {
  const { client } = repositoryClient();

  await assert.rejects(
    settleBookingPayment(
      {
        bookingCode: storedBooking().booking_code,
        email: "someone-else@example.com",
        success: true,
        processPayment: async () => {}
      },
      { runTransaction: (work) => work(client) }
    ),
    (error) => error.code === "NOT_FOUND"
  );
});

test("payment-settled status list follows forward booking states", () => {
  for (const status of ["PAID", "TICKET_ISSUED", "CHECKED_IN", "COMPLETED"]) {
    assert.equal(isPaymentSettledStatus(status), true);
  }
  for (const status of ["PENDING_PAYMENT", "EXPIRED", "CANCELLED"]) {
    assert.equal(isPaymentSettledStatus(status), false);
  }
});

import assert from "node:assert/strict";
import pg from "pg";

import { closePool } from "@bus/shared/db.js";
import {
  createBooking,
  expirePendingBookings,
  settleBookingPayment
} from "../src/repository.js";

const { Client } = pg;

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://bus_app:change_me_local_only@localhost:5432/bus_booking";
const tripId = "66666666-6666-4666-8666-666666666666";
const holdToken = "booking-consistency-hold-token";

const bookingInput = {
  trip_id: tripId,
  hold_token: holdToken,
  contact_email: "booking-consistency@example.com",
  contact_phone: "0900000999",
  passengers: [
    {
      full_name: "Booking Consistency Passenger",
      email: "booking-consistency@example.com",
      seat_id: "C01"
    }
  ]
};

async function withClient(work) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function cleanup() {
  await withClient(async (client) => {
    await client.query(
      `
        delete from event_logs
        where entity_id in (select id from bookings where hold_token = $1)
      `,
      [holdToken]
    );
    await client.query("delete from bookings where hold_token = $1", [holdToken]);
    await client.query("delete from trips where id = $1::uuid", [tripId]);
  });
}

async function seedTrip() {
  await cleanup();
  await withClient(async (client) => {
    const result = await client.query(
      `
        insert into trips (
          id, route_id, vehicle_id, departure_time, arrival_time, price, status
        )
        select $1::uuid, r.id, v.id,
               now() + interval '1 day', now() + interval '1 day 7 hours',
               280000, 'ACTIVE'
        from routes r
        cross join vehicles v
        order by r.id, v.id
        limit 1
        returning id
      `,
      [tripId]
    );
    if (!result.rows[0]) {
      throw new Error("Booking consistency test requires seeded routes and vehicles");
    }
  });
}

async function countBookingsForHold() {
  return withClient(async (client) => {
    const result = await client.query(
      "select count(*)::int as count from bookings where hold_token = $1",
      [holdToken]
    );
    return result.rows[0].count;
  });
}

async function main() {
  await seedTrip();

  try {
    const attempts = await Promise.all([
      createBooking(bookingInput),
      createBooking(bookingInput)
    ]);

    assert.equal(await countBookingsForHold(), 1);
    assert.equal(attempts[0].booking.id, attempts[1].booking.id);
    assert.deepEqual(attempts.map((attempt) => attempt.created).sort(), [false, true]);

    let paymentLockAcquired;
    const lockAcquired = new Promise((resolve) => {
      paymentLockAcquired = resolve;
    });
    let finishPayment;
    const mayFinishPayment = new Promise((resolve) => {
      finishPayment = resolve;
    });

    const settlementPromise = settleBookingPayment({
      bookingCode: attempts[0].booking.booking_code,
      success: true,
      processPayment: async () => {
        paymentLockAcquired();
        await mayFinishPayment;
      }
    });

    await lockAcquired;
    let expiredWhilePaymentLocked;
    try {
      expiredWhilePaymentLocked = await expirePendingBookings(0, {
        bookingIds: [attempts[0].booking.id]
      });
    } finally {
      finishPayment();
    }

    const settlement = await settlementPromise;
    assert.deepEqual(expiredWhilePaymentLocked, []);
    assert.equal(settlement.transitioned, true);
    assert.equal(settlement.booking.status, "PAID");

    console.log("Booking hold-token and payment/expiry consistency tests passed");
  } finally {
    await cleanup();
    await closePool();
  }
}

main().catch(async (error) => {
  console.error(error);
  await closePool().catch(() => {});
  process.exit(1);
});

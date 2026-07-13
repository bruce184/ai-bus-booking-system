import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import Redis from "ioredis";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const currentFile = fileURLToPath(import.meta.url);
const serviceDir = path.resolve(path.dirname(currentFile), "..");
const protoPath = path.resolve(serviceDir, "../../proto/seat_inventory.proto");

const target = process.env.SEAT_INVENTORY_TEST_TARGET ?? "localhost:50052";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://bus_app:change_me_local_only@localhost:5432/bus_booking";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const testVehicleId = "22222222-2222-4222-8222-222222222222";
const testVehicleCode = "SEAT-RACE-TEST-01";
const tripId = "33333333-3333-3333-3333-333333333333";
const seatId = "R01";
const bookingId = "44444444-4444-4444-8444-444444444444";
const bookingCode = "BKRACEATOMIC001";
const missingSeatId = "R99";

function createClient() {
  const packageDefinition = protoLoader.loadSync(protoPath, {
    defaults: true,
    enums: String,
    keepCase: false,
    longs: String,
    oneofs: true
  });
  const loaded = grpc.loadPackageDefinition(packageDefinition);

  return new loaded.bus.seat.v1.SeatInventoryService(
    target,
    grpc.credentials.createInsecure()
  );
}

function call(client, method, payload) {
  return new Promise((resolve, reject) => {
    client[method](payload, (error, response) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForService(client) {
  let lastError = null;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await call(client, "getSeatMap", { tripId });
      return;
    } catch (error) {
      lastError = error;
      await sleep(1000);
    }
  }

  throw lastError ?? new Error("Seat Inventory Service did not become ready");
}

async function cleanupTripHolds(redis) {
  let cursor = "0";
  const keysToDelete = [];

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      `hold:${tripId}:*`,
      "COUNT",
      100
    );
    cursor = nextCursor;
    keysToDelete.push(...keys);
  } while (cursor !== "0");

  if (keysToDelete.length === 0) {
    return;
  }

  const payloads = await redis.mget(keysToDelete);
  const tokenKeys = payloads
    .map((payload) => {
      if (!payload) {
        return null;
      }

      try {
        const parsed = JSON.parse(payload);
        return typeof parsed.holdToken === "string"
          ? `hold-token:${parsed.holdToken}`
          : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  await redis.del(...keysToDelete, ...tokenKeys);
}

async function cleanupRaceFixture(client) {
  await client.query(
    "delete from bookings where id = $1::uuid or booking_code = $2",
    [bookingId, bookingCode]
  );
  await client.query("delete from trip_seats where trip_id = $1::uuid", [tripId]);
  await client.query("delete from trips where id = $1::uuid", [tripId]);
  await client.query(
    "delete from vehicles where id = $1::uuid or vehicle_code = $2",
    [testVehicleId, testVehicleCode]
  );
}

async function seedRaceTrip() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("begin");
    await cleanupRaceFixture(client);

    const routeResult = await client.query(
      `
        select routes.id
        from routes
        join locations origin on origin.id = routes.origin_location_id
        join locations destination on destination.id = routes.destination_location_id
        where origin.name = $1 and destination.name = $2
        limit 1
      `,
      ["TP.HCM", "Da Lat"]
    );

    if (routeResult.rowCount !== 1) {
      throw new Error(
        "Race test requires the seeded TP.HCM -> Da Lat route; run npm run demo:reset"
      );
    }

    const routeId = routeResult.rows[0].id;

    await client.query(
      `
        insert into vehicles (
          id, operator_name, vehicle_code, license_plate, vehicle_type, seat_count
        )
        values ($1::uuid, 'Seat Race Test', $2, 'TEST-RACE-01', 'seat_test_1', 1)
      `,
      [testVehicleId, testVehicleCode]
    );

    await client.query(
      `
        insert into vehicle_seats (
          vehicle_id, seat_label, deck, seat_row, seat_column
        )
        values ($1::uuid, $2, 1, 1, 1)
      `,
      [testVehicleId, seatId]
    );

    await client.query(
      `
        insert into trips (
          id, route_id, vehicle_id, departure_time, arrival_time, price, status
        )
        values (
          $1::uuid, $2::uuid, $3::uuid,
          now() + interval '1 day', now() + interval '1 day 7 hours',
          280000, 'ACTIVE'
        )
      `,
      [tripId, routeId, testVehicleId]
    );

    await client.query(
      `
        insert into trip_seats (
          trip_id, seat_label, status, block_reason, booking_id
        )
        values ($1::uuid, $2, 'AVAILABLE', null, null)
      `,
      [tripId, seatId]
    );

    await client.query(
      `
        insert into bookings (
          id, booking_code, trip_id, hold_token, contact_email, status, total_amount
        )
        values (
          $1::uuid, $2, $3::uuid, 'race-hold-token',
          'race@example.com', 'PENDING_PAYMENT', 280000
        )
      `,
      [bookingId, bookingCode, tripId]
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

async function persistentSeatStatus() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(
      "select status, booking_id from trip_seats where trip_id = $1::uuid and seat_label = $2",
      [tripId, seatId]
    );
    return result.rows[0];
  } finally {
    await client.end();
  }
}

async function cleanupRaceFixtureDatabase() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("begin");
    await cleanupRaceFixture(client);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

async function expectRejected(work, expectedText) {
  try {
    await work();
  } catch (error) {
    const details = error.details ?? error.message;
    if (!String(details).includes(expectedText)) {
      throw new Error(`Expected rejection containing ${expectedText}, received: ${details}`);
    }
    return;
  }

  throw new Error(`Expected request to be rejected with ${expectedText}`);
}

async function main() {
  const redis = new Redis(redisUrl);
  const client = createClient();

  try {
    await seedRaceTrip();
    await cleanupTripHolds(redis);
    await waitForService(client);

    const attempts = await Promise.allSettled([
      call(client, "holdSeats", {
        tripId,
        seatIds: [seatId],
        requesterId: "race-user-a"
      }),
      call(client, "holdSeats", {
        tripId,
        seatIds: [seatId],
        requesterId: "race-user-b"
      })
    ]);

    const successes = attempts.filter((attempt) => attempt.status === "fulfilled");
    const failures = attempts.filter((attempt) => attempt.status === "rejected");

    console.log(`Race attempts: ${successes.length} success, ${failures.length} rejected`);
    failures.forEach((failure, index) => {
      console.log(
        `Rejected attempt ${index + 1}: ${failure.reason.details ?? failure.reason.message}`
      );
    });

    if (successes.length !== 1 || failures.length !== 1) {
      throw new Error("Expected exactly one successful hold and one rejected hold");
    }

    const seatMap = await call(client, "getSeatMap", { tripId });
    const raceSeat = seatMap.seats.find((seat) => seat.label === seatId);

    if (!raceSeat || raceSeat.status !== "HELD") {
      throw new Error(`Expected ${seatId} to be HELD after race test`);
    }

    const failedReason = failures[0].reason.details ?? failures[0].reason.message;
    console.log(`Rejected request: ${failedReason}`);
    console.log(`Seat state after race: ${raceSeat.label}:${raceSeat.status}`);

    await call(client, "releaseHold", {
      holdToken: successes[0].value.holdToken
    });

    await expectRejected(
      () => call(client, "blockSeats", {
        tripId,
        seatIds: [seatId, missingSeatId],
        reason: "atomic block test",
        adminUserId: "55555555-5555-4555-8555-555555555555"
      }),
      missingSeatId
    );
    let persistentSeat = await persistentSeatStatus();
    if (persistentSeat.status !== "AVAILABLE" || persistentSeat.booking_id) {
      throw new Error("BlockSeats partially committed before reporting a missing seat");
    }

    const confirmationHold = await call(client, "holdSeats", {
      tripId,
      seatIds: [seatId],
      requesterId: "atomic-confirm-user"
    });
    await expectRejected(
      () => call(client, "confirmSeats", {
        tripId,
        seatIds: [seatId, missingSeatId],
        holdToken: confirmationHold.holdToken,
        bookingId
      }),
      missingSeatId
    );
    persistentSeat = await persistentSeatStatus();
    if (persistentSeat.status !== "AVAILABLE" || persistentSeat.booking_id) {
      throw new Error("ConfirmSeats partially committed before reporting a missing seat");
    }

    await call(client, "confirmSeats", {
      tripId,
      seatIds: [seatId],
      holdToken: confirmationHold.holdToken,
      bookingId
    });
    persistentSeat = await persistentSeatStatus();
    if (persistentSeat.status !== "BOOKED" || persistentSeat.booking_id !== bookingId) {
      throw new Error("ConfirmSeats did not persist the complete booking ownership");
    }

    // The first confirmation consumes Redis. The same booking must still be
    // able to retry safely without an active hold or a duplicate transition.
    await call(client, "confirmSeats", {
      tripId,
      seatIds: [seatId],
      holdToken: confirmationHold.holdToken,
      bookingId
    });

    console.log("Race, atomic transition, and idempotent confirmation tests passed");
  } finally {
    client.close();
    await cleanupTripHolds(redis);
    await cleanupRaceFixtureDatabase();
    redis.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

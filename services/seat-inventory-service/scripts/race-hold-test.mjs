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

const target = process.env.SEAT_INVENTORY_TEST_TARGET ?? "localhost:50053";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://bus_app:change_me_local_only@localhost:5432/bus_booking";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const tripId = "33333333-3333-3333-3333-333333333333";
const seatId = "R01";

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

async function seedRaceTrip() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  await client.query(`
    with route_seed as (
      insert into routes (origin_location_id, destination_location_id, distance_km)
      select origin.id, destination.id, 300
      from locations origin, locations destination
      where origin.name = 'TP.HCM'
        and destination.name = 'Da Lat'
      on conflict (origin_location_id, destination_location_id)
      do update set distance_km = excluded.distance_km
      returning id
    ), selected_route as (
      select id from route_seed
      union all
      select routes.id
      from routes
      join locations origin on origin.id = routes.origin_location_id
      join locations destination on destination.id = routes.destination_location_id
      where origin.name = 'TP.HCM'
        and destination.name = 'Da Lat'
      limit 1
    ), selected_vehicle as (
      select id from vehicles where vehicle_code = 'PT-SLEEPER-34-01' limit 1
    ), trip_seed as (
      insert into trips (id, route_id, vehicle_id, departure_time, arrival_time, price, status)
      select '${tripId}'::uuid, selected_route.id, selected_vehicle.id,
             now() + interval '1 day', now() + interval '1 day 7 hours',
             280000, 'ACTIVE'
      from selected_route, selected_vehicle
      on conflict (id) do update set status = 'ACTIVE'
      returning id, vehicle_id
    ), vehicle_seat_seed as (
      insert into vehicle_seats (vehicle_id, seat_label, deck, seat_row, seat_column)
      select vehicle_id, '${seatId}', 1, 1, 1
      from trip_seed
      on conflict (vehicle_id, seat_label)
      do update set deck = excluded.deck,
                    seat_row = excluded.seat_row,
                    seat_column = excluded.seat_column
    )
    insert into trip_seats (trip_id, seat_label, status, block_reason, booking_id)
    values ('${tripId}'::uuid, '${seatId}', 'AVAILABLE', null, null)
    on conflict (trip_id, seat_label)
    do update set status = 'AVAILABLE',
                  block_reason = null,
                  booking_id = null,
                  updated_at = now();
  `);

  await client.end();
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

    console.log("Race hold test passed");
  } finally {
    client.close();
    await cleanupTripHolds(redis);
    redis.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

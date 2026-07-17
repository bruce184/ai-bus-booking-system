# Seat Inventory Service

Owns:

- Seat map state
- Redis TTL holds
- Seat confirmation
- Admin blocked seats
- Optional block reason
- Expired hold release behavior
- Seat state change events for GraphQL subscriptions

Contract:

```text
proto/seat_inventory.proto
docs/API_CONTRACT.md
```

Seat holds must be atomic and expire automatically.

## Local Development

This service is scaffolded as a TypeScript gRPC service for task `Q-1`.
`GetSeatMap` is implemented for task `Q-2`, `HoldSeats` is implemented for
task `Q-3`, `ValidateHold` and `ReleaseHold` are implemented for task `Q-4`,
and `ConfirmSeats` is implemented for task `Q-5`; `BlockSeats` is implemented
for task `Q-6`.

Install dependencies:

```bash
npm install
```

Run in development mode:

```bash
npm run dev
```

Run the booking expiration consumer:

```bash
npm run consume:booking-expired
```

Type-check:

```bash
npm run typecheck
```

Run the race-condition integration test after starting the service:

```bash
npm run test:race
```

Default gRPC address:

```text
0.0.0.0:50052
```

Required local dependencies for `GetSeatMap`:

```text
DATABASE_URL=postgresql://bus_app:change_me_local_only@localhost:5432/bus_booking
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
SEAT_HOLD_TTL_SECONDS=300
```

`GetSeatMap` reads `trip_seats`, joins `vehicle_seats` for seat layout
coordinates, and marks seats as `HELD` when Redis contains
`hold:{tripId}:{seatId}`.

`HoldSeats` validates requested seats against `trip_seats`, rejects `BOOKED`
or `BLOCKED` seats, and uses a Redis Lua script to atomically create all
hold keys with the same hold token and TTL.

`ReleaseHold` deletes Redis hold keys by `holdToken`. New holds include a
`hold-token:{holdToken}` index for fast release, with a scan fallback for
older hold payloads.

`ValidateHold` verifies that the hold token still covers every requested seat
for the trip before Booking Service creates a booking.

`ConfirmSeats` verifies that the hold token still covers every requested seat,
locks the complete PostgreSQL seat set, updates every requested seat to
`BOOKED`, stores `booking_id`, and clears the Redis hold. The update is
all-or-none. A retry for seats already booked by the same booking is
idempotent and does not require the consumed Redis hold. Once PostgreSQL
commits `BOOKED`, Redis cleanup is best-effort: a cleanup outage does not report
the confirmation as failed, and any stale hold expires by TTL without
overriding persistent `BOOKED` state.

`BlockSeats` rejects already booked seats, updates `trip_seats.status` to
`BLOCKED`, stores the optional block reason, and clears any temporary Redis
holds for the blocked seats. It locks and validates the complete seat set
before updating, so a missing/booked seat cannot leave a partial block.
Persistent `BLOCKED` likewise remains authoritative if post-commit Redis hold
cleanup is temporarily unavailable.

After the Redis Lua hold succeeds, `HoldSeats` rechecks persistent seat state.
This closes the race where a concurrent block or booking confirmation commits
between the initial PostgreSQL read and the Redis write; persistence wins and
the stale hold is removed.

`test:race` seeds one demo trip seat and sends two concurrent `HoldSeats`
requests for the same seat. It requires exactly one successful hold and one
`SEAT_NOT_AVAILABLE` rejection, then verifies that missing-seat confirm/block
requests do not partially update the existing seat and that retrying
`ConfirmSeats` for the same booking succeeds after the Redis hold is consumed.

`consume:booking-expired` listens for `booking.expired` and `booking.cancelled`
messages on the `bus.workflow` topic exchange. It releases
holds using either `holdToken` or `tripId + seatIds` from the event payload.

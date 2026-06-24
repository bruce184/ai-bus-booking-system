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
task `Q-3`, `ReleaseHold` is implemented for task `Q-4`, and `ConfirmSeats`
is implemented for task `Q-5`; `BlockSeats` is implemented for task `Q-6`.

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
0.0.0.0:50053
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

`ConfirmSeats` verifies that the hold token still covers every requested seat,
updates `trip_seats.status` to `BOOKED`, stores `booking_id`, and clears the
Redis hold.

`BlockSeats` rejects already booked seats, updates `trip_seats.status` to
`BLOCKED`, stores the optional block reason, and clears any temporary Redis
holds for the blocked seats.

`test:race` seeds one demo trip seat and sends two concurrent `HoldSeats`
requests for the same seat. The expected result is exactly one successful hold
and one `SEAT_NOT_AVAILABLE` rejection.

`consume:booking-expired` listens for `booking.expired` messages on the
`bus.workflow` topic exchange using routing key `booking.expired`. It releases
holds using either `holdToken` or `tripId + seatIds` from the event payload.

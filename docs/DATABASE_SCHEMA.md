# DATABASE SCHEMA - AI Bus Booking System

## 1. Purpose

This file is the PostgreSQL schema source of truth for the MVP.

Executable baseline SQL lives in:

```text
database/schema.sql
database/seed.sql
```

The repository currently includes merged service runtimes plus the expanded B-3 demo seed. `database/schema.sql` should stay aligned with this document, and `database/seed.sql` provides deterministic fake data for local admin/frontend demos.

## 2. Database Platform

| Item | Decision |
|---|---|
| Database | PostgreSQL |
| Primary key type | UUID |
| Date/time type | `timestamptz` |
| Display timezone | Asia/Ho_Chi_Minh |
| Demo data | Fake data only |

Calendar dates used by search defaults, analytics metrics, booking codes, and
ticket codes are derived in `Asia/Ho_Chi_Minh`. They must not be obtained by
slicing a UTC ISO timestamp because that returns the previous business date
between local midnight and 06:59.

Required extension:

```sql
create extension if not exists pgcrypto;
```

## 3. MVP Tables

| Table | Purpose |
|---|---|
| `users` | Demo accounts and roles for customer/admin/staff flows |
| `locations` | Provinces/cities/stations for autocomplete and stops |
| `routes` | Origin/destination route definitions |
| `route_stops` | Pickup/dropoff points for routes |
| `vehicles` | Vehicle catalog |
| `vehicle_seats` | Seat layout per vehicle |
| `trips` | Scheduled route + vehicle departure |
| `trip_seats` | Materialized seat state per trip, including admin block reason |
| `bookings` | Booking lifecycle and guest/customer contact |
| `booking_passengers` | Passenger info per booked seat |
| `saved_passengers` | Registered customer reusable passenger profiles |
| `tickets` | Issued e-tickets, QR payload, check-in policy snapshot, optional HTML/PDF output |
| `event_logs` | Main operational logs |
| `analytics_daily` | Demo aggregate reporting |
| `processed_events` | Kafka consumer idempotency (dedup by `eventId`) |
| `workflow_processed_events` | RabbitMQ consumer idempotency keyed by consumer name + canonical `eventId` |
| `outbox_events` | Transactional outbox: events queued with stable `event_id`/`occurred_at` in the same DB transaction as the business write, dispatched by a confirmed publisher; cross-broker copies share identity |

## 4. Roles

Allowed user roles:

```text
ADMIN
STAFF
CUSTOMER
```

`STAFF` is the check-in-focused role. For the local demo it may be implemented as a limited admin permission set.

## 5. Trip Status

Allowed trip status:

```text
DRAFT
ACTIVE
LOCKED
DEPARTED
COMPLETED
CANCELLED
```

Admin can activate or lock a trip, mark it departed/completed, or cancel it according to the assigned task.

## 6. Seat Status

Allowed seat status:

```text
AVAILABLE
HELD
BOOKED
BLOCKED
```

Redis TTL is the source of truth for temporary holds. `trip_seats.status = 'HELD'` is optional for demo visibility and must be cleaned or derived from Redis if stored.

`BLOCKED` seats should preserve an optional `block_reason`.

## 7. Booking Status

Allowed booking status:

```text
DRAFT
PENDING_PAYMENT
PAID
TICKET_ISSUED
CHECKED_IN
COMPLETED
EXPIRED
CANCELLED
```

State transitions are owned by Booking Service.

```text
DRAFT
 -> PENDING_PAYMENT
 -> PAID
 -> TICKET_ISSUED
 -> CHECKED_IN
 -> COMPLETED

PENDING_PAYMENT -> EXPIRED
PAID -> CANCELLED
```

`COMPLETED` is retained for lecturer-contract compatibility and historical
seed rows. The current MVP has no public operation or worker for the final
`CHECKED_IN -> COMPLETED` transition; adding one requires coordinated API and
runtime work rather than a database-only update.

## 8. Ownership and Privacy

1. Registered customer bookings link to `users.id`.
2. Guest bookings use contact email and phone.
3. `bookings.hold_token` stores the internal Seat Inventory hold token captured at checkout so payment confirmation can call `ConfirmSeats`; it is not exposed through public GraphQL or gRPC responses. It carries a `unique` constraint (NULLs excepted) so two bookings can never bind to the same hold.
4. Public booking lookup requires `booking_code` and `contact_email`.
5. Admin/staff check-in may use booking code, ticket code, or simulated QR payload.
6. Saved passenger profiles belong to a registered customer.
7. Do not store real personal data in seed files.

### Database per service

`bookings.customer_user_id`, `bookings.trip_id`, `trip_seats.trip_id`,
`trip_seats.booking_id`, `tickets.booking_id`, `tickets.passenger_id`, and
`saved_passengers.customer_user_id` are references, not physical foreign
keys. All tables still live in one PostgreSQL instance for this local
deployment. Business-critical references do not rely on a shared-schema
constraint: Trip/Booking/Analytics decisions use service APIs as listed below.
The Ticket/Email workflow, `trip_seats` materialized projection, and shared
`event_logs` sink remain explicit local-demo shared-database compromises; see
`docs/ARCHITECTURE.md` section 3. Instead of physical cross-service FKs:

- `bookings.trip_id` is unauthenticated client input, so Booking Service
  verifies existence/price/status/departure time through Trip Service's
  `GetTripDetail` RPC (`services/booking-service/src/trip-client.js`) before
  creating, cancelling, or checking in a booking.
- `bookings.customer_user_id` / `saved_passengers.customer_user_id` are
  trusted from the GraphQL Gateway's already-authenticated caller (the
  gateway issues the id after verifying the demo JWT), not re-checked
  against a `users` table by the service that receives them.
- `trip_seats.booking_id` is trusted from Booking Service's own
  `ConfirmSeats`/`ReleaseBookedSeats` calls to Seat Inventory Service.
- `trip_seats.trip_id` is initialized from Trip Service's trip/vehicle
  projection. Trip deletion explicitly removes those projection rows because
  there is no cross-service cascade.
- `tickets.booking_id` / `tickets.passenger_id` come from Ticket Worker's
  canonical `booking.paid` event context and have no physical constraint into
  Booking Service tables.
- Analytics Service resolves a trip's route label via Trip Service's
  `GetTripDetail` RPC and a booking's cancellation metrics via Booking
  Service's internal `GetBookingMetrics` RPC, instead of joining into
  `trips`/`routes`/`locations` or `bookings`/`booking_passengers`/`event_logs`
  directly. Trip Service's `ListPopularRoutes` reads Analytics Service's
  `GET /popular-routes` HTTP endpoint instead of querying `analytics_daily`
  directly (see `docs/ARCHITECTURE.md` section 3 for the existing read-only
  `analytics_daily` projection precedent this replaces).

## 9. Ticket Data

Ticket Worker creates ticket records after `booking.paid`.

Ticket data must support:

- booking code through the booking relation
- ticket code
- passenger name through `booking_passengers`
- route, pickup/dropoff, departure time, seat, and vehicle through booking/trip joins
- simulated QR payload
- check-in policy snapshot
- simple HTML ticket content in `ticket_html`
- optional PDF location in `ticket_pdf_url`

No production file storage is required for the MVP unless an assigned task adds it.

## 10. Analytics Data

`analytics_daily` stores demo aggregate metrics for:

- search count
- paid booking count
- tickets sold
- revenue
- search-to-paid booking rate

Analytics Service is the sole writer of this table and updates it from Kafka
events. Trip Service may read the `route_label` and `search_count` aggregate as
a projection for its public `ListPopularRoutes` RPC; it must not mutate
analytics rows.

## 11. Index Requirements

Minimum indexes:

```text
locations.name
routes.origin_location_id + routes.destination_location_id
trips.route_id + trips.departure_time
trip_seats.trip_id + trip_seats.seat_label
bookings.booking_code
bookings.contact_email
saved_passengers.customer_user_id
tickets.ticket_code
analytics_daily.metric_date
```

## 12. Seed Data Requirements

Minimum demo data for the database task owner:

| Data | Minimum |
|---|---:|
| Users | 3 roles |
| Locations | 6 provinces/cities |
| Stations/stops | 6 |
| Operators | 3 demo names |
| Vehicles | 3 types |
| Vehicle seat layouts | 3 layouts |
| Routes | 5 |
| Trips | 12 |
| Bookings | 8 |
| Tickets | 6 |
| Event logs | Main flow examples |
| Analytics rows | 7 days |

Use the project spec's suggested demo values:

```text
TP.HCM, Da Lat, Nha Trang, Can Tho, Da Nang, Ha Noi
Mien Dong, Mien Tay, Lien tinh Da Lat, Nha Trang phia Nam
Phuong Trang Demo, Thanh Buoi Demo, Kumho Demo
seat_29, sleeper_34, limousine_22
```

The current `database/seed.sql` includes 3 users, 12 locations/stations, 3
vehicles with generated seat layouts, 5 routes, 20 trips (12 deterministic
historical/state examples plus 8 rolling upcoming demo trips), 8 bookings, 6
tickets, saved passengers, event logs, and 7 analytics rows.

## 13. Schema Change Rule

Changing a table, enum, index, or seed expectation requires updating:

- `docs/DATABASE_SCHEMA.md`
- `database/schema.sql`
- `database/seed.sql` if seed changes
- `docs/API_CONTRACT.md` if exposed fields change
- `graphql/schema.graphql` or `proto/*.proto` if exposed through APIs

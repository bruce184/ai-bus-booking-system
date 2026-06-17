# DATABASE SCHEMA - Intercity Bus Booking AI

## 1. Purpose

This file is the PostgreSQL schema source of truth for the MVP.

Executable baseline SQL lives in:

```text
database/schema.sql
database/seed.sql
```

The repository is currently a contract/setup baseline. `database/schema.sql` should stay aligned with this document. `database/seed.sql` may remain a small bootstrap until the database owner expands the full demo seed set.

## 2. Database Platform

| Item | Decision |
|---|---|
| Database | PostgreSQL |
| Primary key type | UUID |
| Date/time type | `timestamptz` |
| Display timezone | Asia/Ho_Chi_Minh |
| Demo data | Fake data only |

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

## 8. Ownership and Privacy

1. Registered customer bookings link to `users.id`.
2. Guest bookings use contact email and phone.
3. Public booking lookup requires `booking_code` and `contact_email`.
4. Admin/staff check-in may use booking code, ticket code, or simulated QR payload.
5. Saved passenger profiles belong to a registered customer.
6. Do not store real personal data in seed files.

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

Analytics Service owns updating this table from Kafka events.

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

The current `database/seed.sql` is allowed to be a small bootstrap in the baseline phase. Expanding it to the full set above is a database assignment, not required before service owners start from contracts.

## 13. Schema Change Rule

Changing a table, enum, index, or seed expectation requires updating:

- `docs/DATABASE_SCHEMA.md`
- `database/schema.sql`
- `database/seed.sql` if seed changes
- `docs/API_CONTRACT.md` if exposed fields change
- `graphql/schema.graphql` or `proto/*.proto` if exposed through APIs

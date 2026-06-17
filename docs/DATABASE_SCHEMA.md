# DATABASE SCHEMA - Intercity Bus Booking AI

## 1. Purpose

This file is the PostgreSQL schema source of truth for the MVP.

The executable baseline SQL lives in:

```text
database/schema.sql
database/seed.sql
```

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
| `users` | Demo accounts and roles |
| `locations` | Provinces/cities/stations |
| `routes` | Origin/destination route definitions |
| `route_stops` | Pickup/dropoff points for routes |
| `vehicles` | Vehicle catalog |
| `vehicle_seats` | Seat layout per vehicle |
| `trips` | Scheduled route + vehicle departure |
| `trip_seats` | Materialized seat state per trip |
| `bookings` | Booking lifecycle |
| `booking_passengers` | Passenger info per seat |
| `tickets` | Issued e-tickets |
| `event_logs` | Main operational logs |
| `analytics_daily` | Demo aggregate reporting |

## 4. Roles

Allowed user roles:

```text
ADMIN
STAFF
CUSTOMER
```

## 5. Seat Status

```text
AVAILABLE
HELD
BOOKED
BLOCKED
```

Persistent `HELD` rows are optional because Redis TTL is the source of truth for temporary holds. If stored for audit/demo visibility, expired holds must be cleaned or derived from Redis.

## 6. Booking Status

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

## 7. Ownership and Privacy

1. Registered customer bookings link to `users.id`.
2. Guest bookings use contact email and phone.
3. Public booking lookup requires `booking_code` and `contact_email`.
4. Admin/staff check-in may use booking code or ticket code.
5. Do not store real personal data in seed files.

## 8. Index Requirements

Minimum indexes:

```text
locations.name
routes.origin_location_id + routes.destination_location_id
trips.route_id + trips.departure_time
trip_seats.trip_id + trip_seats.seat_label
bookings.booking_code
bookings.contact_email
tickets.ticket_code
analytics_daily.metric_date
```

## 9. Seed Data Requirements

Minimum demo data:

| Data | Minimum |
|---|---:|
| Users | 3 roles |
| Locations | 6 provinces/cities |
| Stations/stops | 6 |
| Operators | 3 demo names |
| Vehicles | 3 types |
| Routes | 5 |
| Trips | 12 |
| Bookings | 8 |
| Tickets | 6 |
| Analytics rows | 7 days |

Use the project spec's suggested demo values:

```text
TP.HCM, Da Lat, Nha Trang, Can Tho, Da Nang, Ha Noi
Mien Dong, Mien Tay, Lien tinh Da Lat, Nha Trang phia Nam
Phuong Trang Demo, Thanh Buoi Demo, Kumho Demo
seat_29, sleeper_34, limousine_22
```

## 10. Schema Change Rule

Changing a table, enum, index, or seed expectation requires updating:

- `docs/DATABASE_SCHEMA.md`
- `database/schema.sql`
- `database/seed.sql` if seed changes
- `docs/API_CONTRACT.md` if exposed fields change

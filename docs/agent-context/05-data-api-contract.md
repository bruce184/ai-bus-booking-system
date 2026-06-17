# Data and API Contract Context

Read these before changing data or integration behavior:

```text
docs/API_CONTRACT.md
docs/DATABASE_SCHEMA.md
graphql/schema.graphql
proto/*.proto
```

## Contract Rule

No silent contract drift.

If code changes a field, enum, operation, RPC method, event name, table, or seed requirement, update the matching contract file in the same task.

## Core Enums

Seat status:

```text
AVAILABLE
HELD
BOOKED
BLOCKED
```

Booking status:

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

Roles:

```text
ADMIN
STAFF
CUSTOMER
```

Trip status:

```text
DRAFT
ACTIVE
LOCKED
DEPARTED
COMPLETED
CANCELLED
```

## Baseline Contract Notes

- `searchTrips` returns `TripSearchResult` so empty-date suggestions and SEO metadata can travel with results.
- Admin route/stop/vehicle/trip CRUD belongs to Trip Service.
- Seat holding and blocking belong to Seat Inventory Service.
- Booking lookup, saved passengers, cancellation, and check-in belong to Booking Service.
- Analytics dashboard data comes from Kafka-derived aggregates.

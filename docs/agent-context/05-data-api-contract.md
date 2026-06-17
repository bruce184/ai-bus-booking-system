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

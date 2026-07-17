# Booking Service

Owns:

- Booking state machine
- Guest and registered checkout
- Passenger per seat data
- Saved passenger profiles
- Booking lookup
- Cancellation
- Check-in state updates
- Admin booking list filters
- Booking privacy rule: booking code and email are required for public lookup
- Ticket-related booking data used by Ticket Worker

Contract:

```text
proto/booking.proto
docs/API_CONTRACT.md
```

## Consistency Invariants

- A Redis hold token is bound idempotently to one complete booking request.
  An identical retry returns the existing booking; conflicting reuse fails.
- Booking creation uses a PostgreSQL advisory transaction lock for the hold
  token so concurrent service instances cannot create duplicate bookings.
- Payment settlement locks the booking row until seat confirmation and the
  `PENDING_PAYMENT -> PAID` transition finish. The expiration sweep uses
  `FOR UPDATE SKIP LOCKED` and cannot expire an in-flight payment.
- Payment Service HTTP and Seat Inventory gRPC calls made while that row is
  locked have a 10-second deadline, preventing an unavailable dependency from
  holding the booking indefinitely.
- Successful payment retries after `PAID` do not reconfirm seats or republish
  the transition events.
- If seat confirmation succeeds but the booking transaction fails, Booking
  Service releases only seats still owned by the non-paid booking.

## Verification

Unit regressions:

```bash
npm test
```

With the documented PostgreSQL schema and seed running, verify concurrent hold
binding plus the payment/expiration lock:

```bash
npm run test:integration
```

The integration script uses deterministic test IDs, removes its own booking and
trip rows, and does not start any service process.

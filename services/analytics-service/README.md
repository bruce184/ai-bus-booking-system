# Analytics Service

Consumes Kafka analytics topics and updates PostgreSQL `analytics_daily`.

Implemented tasks:

- TN-1: service scaffold, PostgreSQL connection, HTTP health endpoint
- TN-2: `search-events` / `trip.search_performed` increments `search_count`
- TN-3: `booking-events` / `booking.paid` and `booking.cancelled` update paid count, revenue, tickets, and rate
- TN-4: `payment-events` / simulated success/failure are consumed and logged without double-counting revenue

Kafka producers use `{ eventName, payload, occurredAt }`. The consumer also
accepts the former flat search-event envelope only for queued-message migration
compatibility.

Malformed envelopes are logged and skipped because retrying an identical
poison record cannot repair it. Database, handler, and other processing
failures reject the Kafka handler so its offset is not acknowledged; Kafka can
redeliver the event after the shared aggregate/idempotency transaction rolls
back.

Run:

```bash
npm --prefix services/analytics-service install
npm run dev:analytics
```

Unit verification:

```bash
npm --prefix services/analytics-service test
```

With PostgreSQL and Kafka running and Analytics Service already consuming:

```bash
npm run test:analytics:integration
```

The integration check uses the real Trip producer, waits at most 15 seconds for
the Analytics consumer, and removes its temporary aggregate row before exit.

Useful endpoints:

```text
GET http://localhost:50056/health
GET http://localhost:50056/admin/revenue-summary?from=2026-06-01&to=2026-06-30
GET http://localhost:50056/admin/dashboard?from=2026-06-01&to=2026-06-30
GET http://localhost:50056/popular-routes?limit=5
```

# Analytics Service

Consumes Kafka analytics topics and updates PostgreSQL `analytics_daily`.

Implemented tasks:

- TN-1: service scaffold, PostgreSQL connection, HTTP health endpoint
- TN-2: `search-events` / `trip.search_performed` increments `search_count`
- TN-3: `booking-events` / `booking.paid` and `booking.cancelled` update paid count, revenue, tickets, and rate
- TN-4: `payment-events` / simulated success/failure are consumed and logged without double-counting revenue

Run:

```bash
npm --prefix services/analytics-service install
npm run dev:analytics
```

Useful endpoints:

```text
GET http://localhost:50056/health
GET http://localhost:50056/admin/revenue-summary?from=2026-06-01&to=2026-06-30
GET http://localhost:50056/admin/dashboard?from=2026-06-01&to=2026-06-30
GET http://localhost:50056/popular-routes?limit=5
```

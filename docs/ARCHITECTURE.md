# ARCHITECTURE - AI Bus Booking System

## 1. Purpose

This document is the architecture source of truth. It defines service boundaries, communication style, events, and ownership for the intercity bus booking project described in the teacher's specification.

The current repository includes the merged GraphQL Gateway, web app, Trip Service, Seat Inventory Service, Booking Service, Payment Service, Ticket Worker, Email Worker, Analytics Service, web AI chatbot route, and MCP Server runtimes.

## 2. High-Level Flow

```text
Guest / Customer / Admin / Staff
  -> Next.js Web
  -> GraphQL Gateway
  -> gRPC services
  -> PostgreSQL / Redis / RabbitMQ / Kafka
```

AI chatbot uses internal tools exposed by the web/gateway layer. External AI clients use the MCP Server.

Nginx is the local reverse proxy for the web/gateway/MCP demo surface when services are implemented.

## 3. Service Ownership

| Service | Owns | Must Not Own |
|---|---|---|
| GraphQL Gateway | Public GraphQL schema, demo auth context, subscriptions, request orchestration | Direct Redis seat mutations or direct database ownership |
| Trip Service | Locations, routes, stops, vehicles, seat layouts, trips, trip search, popular routes | Bookings, payments, private passenger data |
| Seat Inventory Service | Seat map state, Redis holds, seat confirmation, blocked seats | Passenger/contact info |
| Booking Service | Booking state machine, passenger-per-seat data, saved passengers, booking codes, cancellation, check-in | Trip catalog source data |
| Payment Service | Simulated payment success/failure boundary | Real payment credentials |
| Analytics Service | Kafka consumers and aggregate reports | Source transactional ownership |
| MCP Server | External AI tools/resources | Bypassing auth/privacy rules |
| Ticket Worker | E-ticket generation after booking paid | Payment decisions |
| Email Worker | Simulated email/log after ticket issued | Booking lifecycle decisions |

`ListPopularRoutes` remains a Trip Service catalog RPC. It reads the
`analytics_daily.search_count` projection to rank routes through Analytics
Service's `GET /popular-routes` endpoint rather than querying that table
directly; Analytics Service is the only service allowed to read or write
`analytics_daily` in SQL.

### Database per service

All tables share one PostgreSQL instance in this student/local deployment.
Core service references do not use physical foreign keys across ownership
boundaries; identifiers are validated through APIs where they affect business
decisions (see `docs/DATABASE_SCHEMA.md` section 8). This is logical
database-per-service separation, not physically separate databases.

The current MVP still has three explicit shared-database compromises:

- Ticket and Email Workers are asynchronous components of the booking/ticket
  workflow. They read booking/trip context to render demo tickets/emails, and
  Booking Service reads issued ticket output for its response.
- `trip_seats` is a local materialized projection: Trip Service initializes
  and removes it with trip lifecycle changes, while Seat Inventory owns hold,
  booked, and blocked state transitions and reads vehicle layout coordinates.
- Trip deletion performs a read-only logical-reference check against
  `bookings.trip_id` in the shared local database. Booking creation and trip
  deletion take the same PostgreSQL advisory lock keyed by `tripId`; creation
  refreshes Trip Service state under that lock, so neither race order can
  commit an orphaned booking.
- Vehicle layout configuration and trip materialization share a PostgreSQL
  advisory lock keyed by `vehicleId`. Once a vehicle is assigned to a trip,
  its source layout is immutable; changing a trip's vehicle rebuilds only that
  trip's materialized snapshot.
- Trip vehicle replacement and deletion coordinate with Seat Inventory through a bounded
  Redis `seat-maintenance:{tripId}` key. Hold creation checks this key inside
  the same Lua command that creates hold keys. Trip Service scans existing
  holds after acquiring it, locks persistent seat rows, renews owned lease
  state immediately before commit, and only releases it after the topology
  transaction commits. Deletion uses the same protocol before removing the
  trip-seat projection. Redis failure rejects the admin mutation.
- `event_logs` is a shared operational log sink written by workflow services
  and queried through Booking Service for the admin demo.

These joins/projection writes are not hidden as full production isolation. A
deployment with one database/schema per service would replace them with event
payload snapshots or service APIs. The boundaries already enforced in this
MVP are:

- Booking Service calls Trip Service's `GetTripDetail` RPC to verify a
  `trip_id` and read its current price/status/departure time before creating,
  cancelling, or checking in a booking
  (`services/booking-service/src/trip-client.js`), instead of joining into
  `trips`.
- Analytics Service calls Trip Service's `GetTripDetail` RPC for route
  labels and Booking Service's internal `GetBookingMetrics` RPC for
  cancellation reversal, instead of joining into either service's tables
  (`services/analytics-service/src/trip-client.js`,
  `services/analytics-service/src/booking-client.js`).
- `customer_user_id` values are trusted from the GraphQL Gateway's
  already-authenticated caller wherever they appear (`bookings`,
  `saved_passengers`); no service re-validates them against a `users` table.
- Seat Inventory's `trip_seats.trip_id` and Ticket Worker's
  `tickets.booking_id`/`passenger_id` are logical references only. The local
  shared PostgreSQL deployment uses explicit projection cleanup rather than
  cross-service FK cascades.

## 4. Communication Rules

| Path | Protocol |
|---|---|
| Web to Gateway | Next.js `/api/graphql` BFF proxy for HTTP; direct GraphQL WebSocket for public seat updates |
| Gateway to Services | gRPC |
| Service workflow events | RabbitMQ |
| Analytics events | Kafka |
| Seat holds | Redis TTL |
| Reverse proxy | Nginx |
| MCP clients to MCP Server | Official MCP SDK v1 stateless Streamable HTTP |

Browser sessions use one `HttpOnly`, `SameSite=Lax` cookie set by the Next.js
auth route. Browser code never persists JWTs in `localStorage` or a
JavaScript-readable cookie. The checkout/payment/lookup hand-off uses separate
short-lived, AES-GCM-encrypted `HttpOnly`, `SameSite=Lax` BFF context
cookies. The hold token and private lookup email therefore do not enter URLs,
history, referrer headers, or persistent client storage. Context payloads are
type-validated, bound to their flow kind, expire inside the encrypted envelope,
and are accepted only from same-origin mutation requests. Customer and admin
pages use the same GraphQL helper and BFF proxy; `/api/auth/session` resolves
the current user from the Gateway's `me` query instead of trusting a
browser-stored role object.

Frontend must not call internal gRPC services directly.

All repository-owned browser, BFF, service-to-service, MCP, and readiness HTTP
calls use the shared `@bus/shared/http.js` wrapper. It applies a bounded
deadline (default 5 seconds, configurable with `HTTP_REQUEST_TIMEOUT_MS`);
callers may shorten or extend that bound only for a documented operation.
`check:source` rejects raw runtime `fetch()` calls so one path cannot wait
forever while another path times out.

## 5. Core Workflows

### Trip Search and SEO

1. Web sends `searchTrips` query to GraphQL Gateway.
2. Gateway calls Trip Service via gRPC.
3. Trip Service reads PostgreSQL and optional Redis cache.
4. Trip Service publishes search analytics to Kafka topic `search-events`.
5. Gateway returns trips, available filters, nearby-date suggestions when empty, and SEO metadata for route pages.
6. Analytics Service updates `analytics_daily`; Trip Service reads that
   aggregate projection when serving `ListPopularRoutes`.

The search results Server Component owns the initial `searchTrips` request.
`generateMetadata` derives route metadata from URL parameters and does not call
the side-effecting search query. Client form submission navigates to the new
URL and lets that Server Component issue the single business search; client
filter/sort interactions issue one explicit query per interaction.

The Redis search cache stores catalog candidates for the configured short TTL,
but a cache hit re-reads each candidate's current trip state and seat count and
subtracts live Redis holds before applying `minAvailableSeats`. Therefore the
cache avoids repeating the full catalog join/filter query without treating
time-sensitive seat availability as cached truth.

### Trip Detail

1. Web opens a trip detail page.
2. Gateway calls Trip Service for trip, pickup/dropoff points, cancellation policy, and check-in policy.
3. Gateway calls Seat Inventory Service for seat map state.
4. Web displays the seat map and policy text before checkout.

### Seat Hold

1. Web sends `holdSeats(tripId, seatIds)` mutation.
2. Gateway calls Seat Inventory Service; it owns the Redis write.
3. Seat Inventory verifies through Trip Service that the trip is `ACTIVE`,
   then checks persistent booked/blocked state.
4. Seat Inventory atomically checks the Redis topology-maintenance key and
   existing hold keys before creating the TTL hold.
5. After the Redis write, Seat Inventory rechecks both persistent seat state
   and Trip Service status. A failed postcondition immediately discards the
   new hold; if Redis drops during rollback, the request fails and the original
   TTL remains the bounded cleanup path. A concurrent trip lock/departure
   therefore cannot return a usable hold.
6. Redis stores hold keys with TTL, default 5 minutes.
7. Gateway returns hold token and expiry.
8. Seat updates are broadcast with GraphQL Subscription.
9. Redis key-expiry notification publishes `seat.hold_expired`.
10. The Gateway realtime bridge fetches the canonical seat map over gRPC and
    publishes the affected `AVAILABLE` seat through GraphQL Subscription.

### Checkout, Payment, Ticket, Email

1. Web sends passenger/contact details and hold token.
2. Booking Service validates hold and creates `PENDING_PAYMENT`.
3. Payment Service returns simulated success/failure.
4. On success, Booking Service confirms seats through Seat Inventory Service and marks booking `PAID`.
5. Booking Service writes `booking.paid` and analytics events to its transactional outbox; the outbox dispatcher publishes them to RabbitMQ/Kafka.
6. Ticket Worker creates e-ticket records with ticket code, QR payload, policy snapshot, and simple HTML/PDF-ready content.
7. Ticket Worker publishes `ticket.issued`.
8. A durable Gateway workflow queue consumes booking/ticket events, re-fetches
   Booking Service with the event's `bookingCode + contactEmail`, and publishes
   canonical `bookingUpdated` payloads. Booking-paid also refreshes affected
   seats from Seat Inventory.
9. Expiry/cancellation seat releases publish `seat.state_changed` only after
   Seat Inventory completes the idempotent release; the Gateway then refreshes
   and broadcasts canonical seats.
10. Email Worker logs simulated email delivery.

### Booking Lookup and Customer History

1. Public booking lookup requires booking code and email.
2. Registered customers can view their booking history.
3. Registered customers can save passenger profiles for reuse.
4. Cancellation must follow the Booking Service state machine and policy rules.

### Admin Operations

1. Admin logs in through demo auth.
2. Admin manages routes, stops, vehicles, vehicle seat layouts, and trips.
3. Admin activates/locks trips, marks trips `DEPARTED` or `COMPLETED`, and may cancel trips.
4. Admin views bookings by trip/status/customer contact.
5. Admin or staff checks in passengers by booking code, ticket code, or simulated QR payload.
6. Admin can block seats from sale and view event logs.

### Analytics

1. Services publish Kafka events for search, booking, payment, and check-in actions.
2. Analytics Service consumes events.
3. Aggregates are stored in PostgreSQL.
4. Admin dashboard shows revenue by day, tickets sold by route, popular routes, and booking success rate compared with search count.

### Chatbot AI and MCP

1. Chatbot appears in search or booking flows.
2. Chatbot calls internal tools for trip search and booking lookup.
3. Chatbot answers policy questions from internal policy resources and cites the source text.
4. Chatbot refuses private booking details when booking code or email is missing.
5. MCP Server exposes approved tools/resources for external AI clients with the same privacy rules.

## 6. Booking State Machine

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

Only Booking Service may own state transitions.

Trip Service does not update bookings directly. When a trip becomes
`COMPLETED`, its transactional outbox publishes `trip.completed`. Booking
Service claims the event idempotently and advances only `CHECKED_IN` rows to
`COMPLETED`, then publishes `booking.completed` for canonical GraphQL
subscription refresh. Trip completion and check-in serialize on the shared
`trip-lifecycle` advisory lock, closing the stale-snapshot race in both
orders.

## 7. Trip State

```text
DRAFT
ACTIVE
LOCKED
DEPARTED
COMPLETED
CANCELLED
```

Trip state is owned by Trip Service. Booking/check-in flows must respect trip state.

## 8. Seat State

```text
AVAILABLE
HELD
BOOKED
BLOCKED
```

Redis hold key format:

```text
hold:{tripId}:{seatId}
```

Minimum hold metadata:

```json
{
  "holdToken": "uuid",
  "tripId": "trip-id",
  "seatId": "A01",
  "expiresAt": "2026-06-20T10:05:00.000Z"
}
```

## 9. Event Ownership

RabbitMQ workflow events:

```text
trip.completed
booking.completed
booking.paid
ticket.issued
booking.expired
booking.cancelled
```

`email.requested` is accepted by Email Worker as a reserved compatibility
event, but the current MVP has no producer for it. Normal delivery is driven
by `booking.paid` and `ticket.issued`.

Kafka analytics events:

```text
search-events
booking-events
payment-events
checkin-events
```

Trip Service, Booking Service, and Ticket Worker write owned workflow events
to `outbox_events` inside the same transaction as their state changes.
Each runtime's poller declares its owned aggregate type and claims unpublished
rows with `FOR UPDATE SKIP LOCKED`; concurrent pollers cannot dispatch another
owner's row or publish one row simultaneously. A broker outage leaves the row
unpublished for retry instead of losing the event. At-least-once redelivery
keeps the original `eventId`, and state-changing consumers claim it
idempotently. Workflow consumers use dedicated RabbitMQ connections, bind a
prefetch of one, and automatically recreate their channel, DLQ, queue bindings,
and subscription after a broker/channel close. Publisher promises are cleared
after failed confirms/connections so later outbox ticks reconnect instead of
retaining a rejected broker handle. Consumers on `createWorkflowConsumer` also route
processing failures to a per-queue dead-letter exchange instead of
dropping the message.

Ticket Worker claims each canonical `booking.paid` `eventId` in
`workflow_processed_events` inside the same transaction that creates tickets,
advances the booking, writes the log, and queues `ticket.issued` in the
transactional outbox. A RabbitMQ redelivery therefore neither duplicates the
ticket transition nor creates another downstream event.

Because both cancellation and ticket issuance start at `PAID`, Ticket Worker
also locks the booking row in that transaction before reading ticket context.
This makes the race deterministic: cancellation-first produces no tickets or
`ticket.issued`; issuance-first moves to `TICKET_ISSUED`, after which the
cancellation state guard rejects the request.

Email Worker independently claims `(email-worker.notifications, eventId)` in
`workflow_processed_events` before its simulated delivery log, so RabbitMQ
redelivery does not log/send the same notification twice.

Cancellation uses a synchronous `ReleaseBookedSeats` RPC as the fast path and
also queues `booking.cancelled` in the same transaction as the booking state
change. Seat Inventory consumes that event idempotently, so a transient RPC
failure cannot leave cancelled seats permanently booked. Consumer failures use
the shared per-queue DLQ behavior.

## 10. AI and MCP Rules

Chatbot and MCP tools must:

- Call approved internal tools for live/demo data.
- Include policy source text when answering cancellation/check-in policy.
- Refuse private booking status if booking code or email is missing.
- Never invent seat inventory, booking status, payment state, or revenue.

## 11. Architecture Changes

Changing service boundaries, event names, GraphQL schema, gRPC methods, or database ownership requires updating:

- this file
- `docs/API_CONTRACT.md`
- relevant `graphql/` or `proto/` files
- `docs/DATABASE_SCHEMA.md` if persistence changes
- task notes / assignment row

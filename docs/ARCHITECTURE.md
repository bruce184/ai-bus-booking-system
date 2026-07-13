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

All tables share one PostgreSQL instance in this local deployment, but no
service holds a physical foreign key into a table it does not own, and no
service runs a direct SQL join into another service's tables (see
`docs/DATABASE_SCHEMA.md` section 8 for the full list). Where one service
needs data another owns, it calls that service's API:

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
JavaScript-readable cookie. Customer and admin pages use the same GraphQL
helper and BFF proxy; `/api/auth/session` resolves the current user from the
Gateway's `me` query instead of trusting a browser-stored role object.

Frontend must not call internal gRPC services directly.

## 5. Core Workflows

### Trip Search and SEO

1. Web sends `searchTrips` query to GraphQL Gateway.
2. Gateway calls Trip Service via gRPC.
3. Trip Service reads PostgreSQL and optional Redis cache.
4. Trip Service publishes search analytics to Kafka topic `search-events`.
5. Gateway returns trips, available filters, nearby-date suggestions when empty, and SEO metadata for route pages.
6. Analytics Service updates `analytics_daily`; Trip Service reads that
   aggregate projection when serving `ListPopularRoutes`.

### Trip Detail

1. Web opens a trip detail page.
2. Gateway calls Trip Service for trip, pickup/dropoff points, cancellation policy, and check-in policy.
3. Gateway calls Seat Inventory Service for seat map state.
4. Web displays the seat map and policy text before checkout.

### Seat Hold

1. Web sends `holdSeats(tripId, seatIds)` mutation.
2. Gateway calls Booking Service or Seat Inventory Service according to the implementation task, but Seat Inventory Service must own the Redis write.
3. Seat Inventory Service atomically checks booked/blocked state and Redis hold keys.
4. Redis stores hold keys with TTL, default 5 minutes.
5. Gateway returns hold token and expiry.
6. Seat updates are broadcast with GraphQL Subscription.
7. When TTL expires, the seat becomes `AVAILABLE` again and clients receive an update when implemented.

### Checkout, Payment, Ticket, Email

1. Web sends passenger/contact details and hold token.
2. Booking Service validates hold and creates `PENDING_PAYMENT`.
3. Payment Service returns simulated success/failure.
4. On success, Booking Service confirms seats through Seat Inventory Service and marks booking `PAID`.
5. Booking Service publishes `booking.paid` to RabbitMQ and analytics events to Kafka.
6. Ticket Worker creates e-ticket records with ticket code, QR payload, policy snapshot, and simple HTML/PDF-ready content.
7. Ticket Worker publishes `ticket.issued`.
8. Email Worker logs simulated email delivery.

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
booking.paid
ticket.issued
email.requested
booking.expired
```

Kafka analytics events:

```text
search-events
booking-events
payment-events
checkin-events
```

Booking Service writes its workflow/analytics events (`booking.created`,
`booking.paid`, `booking.cancelled`, `booking.expired`, `ticket.checked_in`)
to the `outbox_events` table inside the same transaction as the state
change, instead of publishing directly. A poller
(`dispatchOutboxEvents` in `packages/shared/src/outbox.js`, run on an
interval from `services/booking-service/src/index.js`) reads unpublished
rows and publishes them; a broker outage just delays dispatch instead of
losing the event. Consumers on `createWorkflowConsumer` also route
processing failures to a per-queue dead-letter exchange instead of
dropping the message.

Ticket Worker claims each canonical `booking.paid` `eventId` in
`workflow_processed_events` inside the same transaction that creates tickets,
advances the booking, writes the log, and queues `ticket.issued` in the
transactional outbox. A RabbitMQ redelivery therefore neither duplicates the
ticket transition nor creates another downstream event.

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

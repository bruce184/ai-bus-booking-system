# ARCHITECTURE - Intercity Bus Booking AI

## 1. Purpose

This document is the architecture source of truth. It defines service boundaries, communication style, events, and ownership.

## 2. High-Level Flow

```text
Customer/Admin
  -> Next.js Web
  -> GraphQL Gateway
  -> gRPC services
  -> PostgreSQL / Redis / RabbitMQ / Kafka
```

AI chatbot uses internal tools exposed by the web/gateway layer. External AI clients use the MCP Server.

## 3. Service Ownership

| Service | Owns | Must Not Own |
|---|---|---|
| GraphQL Gateway | Public GraphQL schema, auth context, subscriptions, request orchestration | Direct seat mutations in Redis |
| Trip Service | Provinces, stations, routes, stops, vehicles, trips, search | Bookings, payments |
| Seat Inventory Service | Seat map state, Redis holds, seat confirmation, blocked seats | Passenger/contact info |
| Booking Service | Booking state machine, passengers, booking codes, cancellation | Trip catalog source data |
| Payment Service | Simulated payment result boundary | Real payment credentials |
| Notification Service | Notification templates and dispatch interface | Ticket generation |
| Analytics Service | Kafka consumers and aggregate reports | Source transactional ownership |
| MCP Server | External AI tools/resources | Bypassing auth/privacy rules |
| Ticket Worker | E-ticket generation after booking paid | Payment decisions |
| Email Worker | Simulated email/log after ticket issued | Booking lifecycle decisions |

## 4. Communication Rules

| Path | Protocol |
|---|---|
| Web to Gateway | GraphQL HTTP / GraphQL WebSocket |
| Gateway to Services | gRPC |
| Service events | RabbitMQ for workflow events, Kafka for analytics events |
| Seat holds | Redis TTL |
| Reverse proxy | Nginx |
| MCP clients to MCP Server | MCP transport selected during implementation |

## 5. Core Workflows

### Trip Search

1. Web sends `searchTrips` query to GraphQL Gateway.
2. Gateway calls Trip Service via gRPC.
3. Trip Service reads PostgreSQL and optional Redis cache.
4. Trip Service publishes search analytics to Kafka topic `search-events`.
5. Gateway returns trips and filters.

### Seat Hold

1. Web sends `holdSeats(tripId, seatIds)` mutation.
2. Gateway calls Booking Service or Seat Inventory Service via gRPC according to implementation task.
3. Seat Inventory Service atomically checks booked/blocked state and Redis hold keys.
4. Redis stores hold keys with TTL, default 5 minutes.
5. Gateway returns hold token and expiry.
6. Seat updates are broadcast with GraphQL Subscription.

### Checkout

1. Web sends passenger/contact details and hold token.
2. Booking Service validates hold and creates `PENDING_PAYMENT`.
3. Payment Service returns simulated success/failure.
4. On success, Booking Service confirms seats and marks booking `PAID`.
5. Booking Service publishes `booking.paid` to RabbitMQ and analytics events to Kafka.
6. Ticket Worker creates e-ticket.
7. Email Worker logs simulated email.

### Check-in

1. Admin/staff searches booking by booking code or ticket code.
2. Booking Service validates status and trip.
3. Booking/ticket is marked checked in.
4. Analytics event is published.

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

## 7. Seat State

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

## 8. Event Ownership

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

## 9. AI and MCP Rules

Chatbot and MCP tools must:

- Call approved internal tools for live/demo data.
- Include policy source text when answering cancellation/check-in policy.
- Refuse private booking status if booking code or email is missing.
- Never invent seat inventory, booking status, or revenue data.

## 10. Architecture Changes

Changing service boundaries, event names, GraphQL schema, gRPC methods, or database ownership requires updating:

- this file
- `docs/API_CONTRACT.md`
- relevant `graphql/` or `proto/` files
- task notes / assignment row

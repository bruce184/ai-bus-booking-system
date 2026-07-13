# API CONTRACT - AI Bus Booking System

## 1. Purpose

This file is the source of truth for public GraphQL operations, internal gRPC boundaries, workflow events, analytics events, and MCP tools/resources.

The repository currently includes the GraphQL Gateway, web app, core trip, seat inventory, booking, payment, ticket, email, analytics, chatbot route, and MCP runtimes for the merged MVP modules. Remaining module code must follow this contract unless a task explicitly changes the contract and updates all affected files.

## 2. Public GraphQL Endpoint

```text
HTTP: http://localhost:4000/graphql
WS:   ws://localhost:4000/graphql
```

GraphQL schema source:

```text
graphql/schema.graphql
```

## 3. Roles and Access

| Role | Purpose |
|---|---|
| Guest Customer | Search trips, hold seats, guest checkout, payment simulation, booking lookup by booking code and email |
| Registered Customer | Guest abilities plus booking history, saved passenger profiles, and cancellation |
| Admin | Manage routes, stops, vehicles, trips, bookings, check-in, seat blocks, reports |
| Staff | Check-in focused role; may be implemented as a limited admin role in the local demo |

Admin login is required for admin screens in the MVP. Local demo auth may use seeded users and a simple token; production-grade auth is out of scope unless assigned.

## 4. GraphQL Operations

### Public and Customer Queries

| Operation | Purpose |
|---|---|
| `me` | Return current user when demo auth is implemented |
| `autocompleteLocations(keyword)` | Suggest provinces, cities, and stations |
| `searchTrips(input)` | Search trips by origin, destination, departure date, filters, and sort |
| `trip(id)` | Get trip detail, pickup/dropoff points, policies, and seat map |
| `seatMap(tripId)` | Get current seat states for a trip |
| `bookingStatus(bookingCode, email)` | Public lookup; must require both booking code and email |
| `myBookings` | Registered customer booking history |
| `mySavedPassengers` | Registered customer saved passenger profiles |
| `popularRoutes(limit)` | Popular searched routes for public display |

### Admin Queries

| Operation | Purpose |
|---|---|
| `adminLocations` | Admin catalog list of locations/stations used by route and stop screens |
| `adminRoutes` | Admin catalog list of routes with origin, destination, distance, and stops |
| `adminVehicles` | Admin catalog list of vehicles and seat counts |
| `adminTrips` | Admin catalog list of scheduled trips |
| `adminStops` | Admin catalog list of pickup/dropoff stops |
| `adminBookings(input)` | Admin booking list, filterable by trip, status, email, or booking code |
| `adminRevenueSummary(input)` | Revenue, paid booking count, ticket count, and search-to-paid rate |
| `adminAnalyticsDashboard(input)` | Daily revenue, tickets by route, popular routes, and summary |
| `adminEventLogs(input)` | Main operational logs such as trip creation, booking paid, check-in |

### Mutations

| Operation | Purpose |
|---|---|
| `login(input)` | Local demo login for admin/customer flows |
| `savePassengerProfile(input)` | Registered customer saves reusable passenger information |
| `deleteSavedPassenger(id)` | Registered customer deletes a saved passenger profile |
| `holdSeats(input)` | Temporarily hold seats through Seat Inventory Service and Redis TTL |
| `releaseSeatHold(input)` | Release a hold before TTL expiry |
| `createBooking(input)` | Create a `PENDING_PAYMENT` booking from a valid hold token |
| `simulatePayment(input)` | Simulate payment success/failure; requires booking code and email (same pairing as `cancelBooking`) |
| `cancelBooking(input)` | Cancel an eligible booking by booking code and email |
| `adminCreateRoute(input)` / `adminUpdateRoute` / `adminDeleteRoute` | Admin route CRUD |
| `adminCreateStop(input)` / `adminUpdateStop` / `adminDeleteStop` | Admin pickup/dropoff stop CRUD |
| `adminCreateVehicle(input)` / `adminUpdateVehicle` / `adminDeleteVehicle` | Admin vehicle CRUD |
| `adminConfigureVehicleSeats(vehicleId, seats)` | Configure vehicle seat layout |
| `adminCreateTrip(input)` / `adminUpdateTrip` / `adminDeleteTrip` | Admin trip CRUD; changing `vehicleId` rebuilds `trip_seats` from the new vehicle's layout and is rejected if any seat on the trip is already held, booked, or blocked |
| `adminUpdateTripStatus(input)` | Activate, lock, depart, complete, cancel, or draft a trip |
| `adminBlockSeats(input)` | Block seats from sale with an optional reason |
| `adminCheckIn(input)` | Check in by booking code, ticket code, or simulated QR payload |

### Subscriptions

| Operation | Purpose |
|---|---|
| `seatStateChanged(tripId)` | Real-time seat state updates after hold, release, confirm, block, or expiry |
| `bookingUpdated(bookingCode, email)` | Booking status updates; email must match the booking's contact email (same check as `bookingStatus`) or the subscription is rejected |

## 5. Search and Trip Rules

`searchTrips(input)` must support:

- origin, destination, and departure date
- autocomplete-driven location names
- filters by departure time range, price, operator, vehicle type, and minimum available seats
- sorting by lowest price, earliest departure, or shortest duration
- Redis caching for popular searches
- Kafka event `trip.search_performed`
- empty-state suggestions for nearby available dates
- route SEO metadata such as `Ve xe TP.HCM di Da Lat ngay 20/06`

The GraphQL response is `TripSearchResult`, not a bare trip array, so it can carry `suggestedDates`, `seoTitle`, and `cacheHit`.

Trip detail ownership is split deliberately: Trip Service `GetTripDetail`
returns trip metadata, pickup/dropoff points, and policy text, while
`TripDetail.seats` is resolved by the GraphQL Gateway through Seat Inventory
Service `GetSeatMap`. Trip Service must not return a second, stale seat-state
copy.

`ListPopularRoutes` is owned by Trip Service and ranks the read-only
`analytics_daily.search_count` projection. Analytics Service remains the sole
writer of that aggregate table.

## 6. Core Data Objects

### Trip Search Result

```json
{
  "trips": [
    {
      "id": "trip-demo-001",
      "route": {
        "origin": { "name": "TP.HCM" },
        "destination": { "name": "Da Lat" }
      },
      "operatorName": "Phuong Trang Demo",
      "vehicleType": "sleeper_34",
      "departureTime": "2026-06-20T20:00:00+07:00",
      "arrivalTime": "2026-06-21T03:30:00+07:00",
      "durationMinutes": 450,
      "price": 280000,
      "availableSeats": 12
    }
  ],
  "suggestedDates": [],
  "seoTitle": "Ve xe TP.HCM di Da Lat ngay 20/06",
  "cacheHit": false
}
```

### Seat

Allowed seat status:

```text
AVAILABLE
HELD
BOOKED
BLOCKED
```

```json
{
  "id": "A01",
  "label": "A01",
  "deck": 1,
  "row": 1,
  "column": 1,
  "status": "AVAILABLE"
}
```

### Booking

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

```json
{
  "bookingCode": "BK202606200001",
  "status": "PENDING_PAYMENT",
  "tripId": "trip-demo-001",
  "contactEmail": "guest@example.com",
  "totalAmount": 560000,
  "passengers": [
    { "fullName": "Passenger Demo", "seatId": "A01" }
  ],
  "tickets": []
}
```

### Ticket

Ticket Worker must generate a simple e-ticket record after `booking.paid`.

Ticket content must include:

- booking code
- ticket code
- passenger name
- route label
- pickup point
- dropoff point
- departure date/time
- seat label
- vehicle code or license plate
- simulated QR payload such as `bookingCode-ticketId`
- check-in policy snapshot
- simple HTML content; PDF output is optional but reserved in the contract

## 7. Standard Error Codes

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Invalid input |
| `UNAUTHORIZED` | Missing/invalid auth |
| `FORBIDDEN` | Role is not allowed |
| `NOT_FOUND` | Resource missing or inaccessible |
| `SEAT_NOT_AVAILABLE` | Seat is held/booked/blocked |
| `HOLD_EXPIRED` | Seat hold token expired |
| `BOOKING_STATE_INVALID` | Invalid booking transition |
| `PAYMENT_FAILED` | Simulated payment failed |
| `SERVICE_TIMEOUT` | Downstream service exceeded the gRPC call deadline |
| `INTERNAL_ERROR` | Unexpected server/service error |

Private resources should return `NOT_FOUND` when the caller should not know they exist.

## 8. gRPC Services

Proto sources:

```text
proto/trip.proto
proto/seat_inventory.proto
proto/booking.proto
```

### Trip Service

Owns locations, routes, stops, vehicles, vehicle seats, trips, popular routes, trip search, and trip detail.

| RPC Group | RPCs |
|---|---|
| Search/catalog | `AutocompleteLocations`, `SearchTrips`, `GetTripDetail`, `GetTripsByIds`, `ListPopularRoutes` |
| Admin catalog reads | `ListLocations`, `ListRoutes`, `ListVehicles`, `ListTrips` |
| Route admin | `CreateRoute`, `UpdateRoute`, `DeleteRoute` |
| Stop admin | `CreateStop`, `UpdateStop`, `DeleteStop` |
| Vehicle admin | `CreateVehicle`, `UpdateVehicle`, `DeleteVehicle`, `ConfigureVehicleSeats` |
| Trip admin | `CreateTrip`, `UpdateTrip`, `DeleteTrip`, `UpdateTripStatus` |

### Seat Inventory Service

Owns seat map state, Redis holds, seat confirmation, and blocked seats.

| RPC | Purpose |
|---|---|
| `GetSeatMap` | Get current seat states |
| `HoldSeats` | Atomically hold seats with Redis TTL |
| `ValidateHold` | Verify a hold token still covers the requested trip seats before booking creation |
| `ReleaseHold` | Release a hold before TTL expiry |
| `ConfirmSeats` | Convert held seats to booked after payment success |
| `ReleaseBookedSeats` | Release seats booked by a cancelled booking back to available |
| `BlockSeats` | Admin blocks seats from sale |

### Booking Service

Owns booking state machine, passenger-per-seat data, booking lookup privacy, cancellation, check-in, and saved passenger profiles.

| RPC | Purpose |
|---|---|
| `CreateBooking` | Create booking from hold token and passengers |
| `GetBookingStatus` | Lookup with booking code and email |
| `ListCustomerBookings` | Registered customer booking history |
| `ListAdminBookings` | Admin booking list |
| `SimulatePayment` | Simulate payment result; requires booking code and email (same pairing as `CancelBooking`) |
| `CancelBooking` | Cancel eligible booking |
| `CheckInPassenger` | Admin/staff check-in |
| `SavePassengerProfile` / `DeletePassengerProfile` / `ListPassengerProfiles` | Registered customer saved passenger profiles |
| `ListEventLogs` | Query operational event logs for admin |
| `GetBookingMetrics` | Internal only (Analytics Service caller, not exposed through the Gateway): total amount, ticket count, and paid-at timestamp for a booking id |

## 9. Events

### RabbitMQ Workflow Events

| Event | Publisher | Consumers |
|---|---|---|
| `booking.paid` | Booking Service | Ticket Worker, Email Worker |
| `ticket.issued` | Ticket Worker | Email Worker |
| `email.requested` | Booking/Ticket flow | Email Worker |
| `booking.expired` | Booking Service | Seat Inventory Service |
| `booking.cancelled` | Booking Service | Seat Inventory Service (idempotent recovery for booked-seat release) |

### Kafka Analytics Events

| Topic | Event |
|---|---|
| `search-events` | `trip.search_performed` |
| `booking-events` | `booking.created`, `booking.paid`, `booking.cancelled` |
| `payment-events` | `payment.simulated_success`, `payment.simulated_failure` |
| `checkin-events` | `ticket.checked_in` |

Analytics Service consumes Kafka events and stores aggregates for daily revenue, tickets sold by route, popular routes, and booking success rate versus search count.

Payment Service treats `payment-events` as best-effort analytics. It returns
the already-decided simulation result without waiting for Kafka and logs an
analytics publish failure; broker availability must not change that business
result into an HTTP 500 response.

RabbitMQ consumers use the same canonical `eventId` for idempotency. Ticket
Worker records `(consumerName, eventId)` in its local transaction and queues
`ticket.issued` through the transactional outbox; it never publishes that
workflow event after committing ticket state.

All producers use the canonical JSON envelope:

```json
{
  "eventId": "8c8f4f5e-9f2a-4c1e-9a3d-2f4f7b1a6c11",
  "eventName": "trip.search_performed",
  "payload": {
    "origin": "TP.HCM",
    "destination": "Da Lat",
    "departureDate": "2026-07-12",
    "resultCount": 3,
    "cacheHit": false
  },
  "occurredAt": "2026-07-11T01:00:00.000Z"
}
```

`eventId` is a producer-generated UUID. Analytics Service records it in
`processed_events` before applying aggregates, so redelivered Kafka messages
(at-least-once) are skipped instead of double-counted. Events without an
`eventId` (legacy) are processed without deduplication.

Analytics consumer retry policy distinguishes deterministic envelope errors
from transient processing failures. Malformed JSON/envelopes are logged and
skipped so a poison record cannot block its partition. Database or handler
failures reject message processing without acknowledging the offset; the
aggregate write and `processed_events` marker roll back together before Kafka
redelivers the canonical `eventId`.

Transactional-outbox producers persist `eventId` and `occurredAt` in the
outbox row together with the business transaction. Every retry republishes that
same envelope identity. RabbitMQ publishers wait for a broker confirmation
before the dispatcher stamps `published_at`; Kafka publishers await `send()`.
When one logical event is routed to both brokers, both outbox rows share the
same `eventId` and `occurredAt` for end-to-end correlation; uniqueness is per
target/routing key rather than globally per row.

During the search-event migration, Analytics Service may consume the previous
flat `{ "event": "trip.search_performed", ... }` shape for queued-message
compatibility. New events must use the canonical envelope.

## 10. Booking and Seat Workflows

### Seat Hold

1. Web sends `holdSeats(tripId, seatIds)` to GraphQL Gateway.
2. Gateway asks Booking Service to coordinate the request or calls Seat Inventory Service according to the assigned implementation task.
3. Seat Inventory Service checks persistent booked/blocked state and Redis hold keys atomically.
4. Redis stores hold keys with a TTL, default 5 minutes.
5. Gateway returns hold token and expiry.
6. GraphQL Subscription broadcasts seat changes.

Hold and seat transition invariants:

- A hold token may be bound to only one logical booking request. Repeating the
  same `createBooking` request returns the existing booking; reusing that token
  with different trip, contact, customer, or passenger data is rejected.
- `ConfirmSeats` and `BlockSeats` are all-or-none for the requested seat set.
  Missing or unavailable seats must be detected before any requested seat is
  changed.
- Retrying `ConfirmSeats` with the same `booking_id` after all requested seats
  are already booked by that booking is idempotent and succeeds without an
  active Redis hold. A different booking may never claim those seats.

### Checkout and Ticket

1. Web sends passenger/contact details and hold token.
2. Booking Service validates hold and creates `PENDING_PAYMENT`.
3. Payment Service simulates success/failure.
4. On success, Booking Service confirms seats and marks booking `PAID`.
5. Booking Service publishes `booking.paid`.
6. Ticket Worker creates tickets and publishes `ticket.issued`.
7. Email Worker logs simulated email delivery.

Payment and expiry for the same booking must be serialized by Booking Service.
An expiry sweep must skip a booking whose payment transition is in progress,
and concurrent successful payment retries must produce only one transition to
`PAID`.

## 11. MCP Server Contract

MCP tools:

| Tool | Purpose | Minimum auth/privacy rule |
|---|---|---|
| `search_trips` | Find trips by origin, destination, date | Public demo data allowed |
| `get_trip_detail` | Get trip detail | Public demo data allowed |
| `get_booking_status` | Lookup booking status | Requires booking code and email |
| `get_revenue_summary` | Admin revenue summary | Requires `Authorization: Bearer <MCP_ADMIN_TOKEN>` on the MCP HTTP request; the secret is never a tool argument |
| `get_popular_routes` | Popular route analytics | Public aggregate data allowed |

MCP resources:

| Resource | Content |
|---|---|
| `bus://policy/cancellation` | Cancellation policy |
| `bus://policy/checkin` | Check-in policy |
| `bus://routes/popular` | Popular demo routes |
| `bus://system/health` | Demo service health |

`bus://policy/cancellation`, Trip detail, chatbot policy answers, MCP policy
reads, and Booking Service enforcement share one demo rule: only a `PAID`
booking at least 24 hours before departure can be cancelled, with an 80%
refund; within 24 hours it cannot be cancelled and receives no refund.

MCP and chatbot responses must not fabricate trip inventory, booking status, seat state, or revenue.

The MCP endpoint uses the official TypeScript SDK v1 stateless Streamable HTTP
transport. Standard SDK clients negotiate the protocol version and required
HTTP headers; the server does not hand-roll lifecycle or JSON-RPC dispatch.

## 12. Frontend Integration Rules

Frontend must:

1. Use GraphQL operations instead of direct service calls.
2. Handle loading, error, empty, success, and expired-hold states.
3. Display countdown from `hold.expiresAt`.
4. Ask for booking code and email before private booking lookup.
5. Treat GraphQL `UNAUTHORIZED` as a login/session issue.
6. Show policy source text for AI policy answers.
7. Send browser GraphQL HTTP requests through Next.js `/api/graphql`; store the
   Gateway JWT only in the BFF-managed `HttpOnly` session cookie, never
   `localStorage` or a JavaScript-readable cookie.

## 13. Contract Change Rule

When changing API behavior, update all affected files:

```text
docs/API_CONTRACT.md
graphql/schema.graphql
proto/*.proto
docs/ARCHITECTURE.md if boundary changes
docs/DATABASE_SCHEMA.md if persistence changes
docs/README_SETUP.md if setup, ports, or run commands change
```

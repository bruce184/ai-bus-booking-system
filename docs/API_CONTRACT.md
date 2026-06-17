# API CONTRACT - Intercity Bus Booking AI

## 1. Purpose

This file is the source of truth for public GraphQL operations, internal gRPC boundaries, workflow events, analytics events, and MCP tools/resources.

The repository is currently a baseline setup. Service code may be added later by assigned members, but new code must follow this contract unless a task explicitly changes the contract and updates all affected files.

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
| `simulatePayment(input)` | Simulate payment success/failure |
| `cancelBooking(input)` | Cancel an eligible booking by booking code and email |
| `adminCreateRoute(input)` / `adminUpdateRoute` / `adminDeleteRoute` | Admin route CRUD |
| `adminCreateStop(input)` / `adminUpdateStop` / `adminDeleteStop` | Admin pickup/dropoff stop CRUD |
| `adminCreateVehicle(input)` / `adminUpdateVehicle` / `adminDeleteVehicle` | Admin vehicle CRUD |
| `adminConfigureVehicleSeats(vehicleId, seats)` | Configure vehicle seat layout |
| `adminCreateTrip(input)` / `adminUpdateTrip` / `adminDeleteTrip` | Admin trip CRUD |
| `adminUpdateTripStatus(input)` | Activate, lock, depart, complete, cancel, or draft a trip |
| `adminBlockSeats(input)` | Block seats from sale with an optional reason |
| `adminCheckIn(input)` | Check in by booking code, ticket code, or simulated QR payload |

### Subscriptions

| Operation | Purpose |
|---|---|
| `seatStateChanged(tripId)` | Real-time seat state updates after hold, release, confirm, block, or expiry |
| `bookingUpdated(bookingCode)` | Booking status updates |

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
| Search/catalog | `AutocompleteLocations`, `SearchTrips`, `GetTripDetail`, `ListPopularRoutes` |
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
| `ReleaseHold` | Release a hold before TTL expiry |
| `ConfirmSeats` | Convert held seats to booked after payment success |
| `BlockSeats` | Admin blocks seats from sale |

### Booking Service

Owns booking state machine, passenger-per-seat data, booking lookup privacy, cancellation, check-in, and saved passenger profiles.

| RPC | Purpose |
|---|---|
| `CreateBooking` | Create booking from hold token and passengers |
| `GetBookingStatus` | Lookup with booking code and email |
| `ListCustomerBookings` | Registered customer booking history |
| `ListAdminBookings` | Admin booking list |
| `SimulatePayment` | Simulate payment result |
| `CancelBooking` | Cancel eligible booking |
| `CheckInPassenger` | Admin/staff check-in |
| `SavePassengerProfile` / `DeletePassengerProfile` / `ListPassengerProfiles` | Registered customer saved passenger profiles |

## 9. Events

### RabbitMQ Workflow Events

| Event | Publisher | Consumers |
|---|---|---|
| `booking.paid` | Booking Service | Ticket Worker, Email Worker |
| `ticket.issued` | Ticket Worker | Email Worker |
| `email.requested` | Booking/Ticket flow | Email Worker |
| `booking.expired` | Booking Service | Seat Inventory Service |

### Kafka Analytics Events

| Topic | Event |
|---|---|
| `search-events` | `trip.search_performed` |
| `booking-events` | `booking.created`, `booking.paid`, `booking.cancelled` |
| `payment-events` | `payment.simulated_success`, `payment.simulated_failure` |
| `checkin-events` | `ticket.checked_in` |

Analytics Service consumes Kafka events and stores aggregates for daily revenue, tickets sold by route, popular routes, and booking success rate versus search count.

## 10. Booking and Seat Workflows

### Seat Hold

1. Web sends `holdSeats(tripId, seatIds)` to GraphQL Gateway.
2. Gateway asks Booking Service to coordinate the request or calls Seat Inventory Service according to the assigned implementation task.
3. Seat Inventory Service checks persistent booked/blocked state and Redis hold keys atomically.
4. Redis stores hold keys with a TTL, default 5 minutes.
5. Gateway returns hold token and expiry.
6. GraphQL Subscription broadcasts seat changes.

### Checkout and Ticket

1. Web sends passenger/contact details and hold token.
2. Booking Service validates hold and creates `PENDING_PAYMENT`.
3. Payment Service simulates success/failure.
4. On success, Booking Service confirms seats and marks booking `PAID`.
5. Booking Service publishes `booking.paid`.
6. Ticket Worker creates tickets and publishes `ticket.issued`.
7. Email Worker logs simulated email delivery.

## 11. MCP Server Contract

MCP tools:

| Tool | Purpose | Minimum auth/privacy rule |
|---|---|---|
| `search_trips` | Find trips by origin, destination, date | Public demo data allowed |
| `get_trip_detail` | Get trip detail | Public demo data allowed |
| `get_booking_status` | Lookup booking status | Requires booking code and email |
| `get_revenue_summary` | Admin revenue summary | Admin-only in final implementation |
| `get_popular_routes` | Popular route analytics | Public aggregate data allowed |

MCP resources:

| Resource | Content |
|---|---|
| `bus://policy/cancellation` | Cancellation policy |
| `bus://policy/checkin` | Check-in policy |
| `bus://routes/popular` | Popular demo routes |
| `bus://system/health` | Demo service health |

MCP and chatbot responses must not fabricate trip inventory, booking status, seat state, or revenue.

## 12. Frontend Integration Rules

Frontend must:

1. Use GraphQL operations instead of direct service calls.
2. Handle loading, error, empty, success, and expired-hold states.
3. Display countdown from `hold.expiresAt`.
4. Ask for booking code and email before private booking lookup.
5. Treat GraphQL `UNAUTHORIZED` as a login/session issue.
6. Show policy source text for AI policy answers.

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

# API CONTRACT - Intercity Bus Booking AI

## 1. Purpose

This file is the contract source of truth for GraphQL operations, gRPC boundaries, events, and MCP tools.

If a request field, response field, error code, event, gRPC method, or MCP tool changes, update this file in the same task.

## 2. Public GraphQL Endpoint

```text
HTTP: http://localhost:4000/graphql
WS:   ws://localhost:4000/graphql
```

GraphQL schema source:

```text
graphql/schema.graphql
```

## 3. GraphQL Operations

### Queries

| Operation | Purpose |
|---|---|
| `autocompleteLocations(keyword)` | Suggest provinces/stations |
| `searchTrips(input)` | Search trips by origin, destination, date, filters |
| `trip(id)` | Get trip detail, pickup/dropoff, policy, seat map |
| `bookingStatus(bookingCode, email)` | Public booking lookup with email check |
| `myBookings` | Registered customer booking history |
| `adminRevenueSummary(input)` | Admin revenue summary |
| `adminBookings(input)` | Admin booking list |
| `popularRoutes(input)` | Popular searched routes |

### Mutations

| Operation | Purpose |
|---|---|
| `holdSeats(input)` | Temporarily hold seats |
| `releaseSeatHold(input)` | Release a hold before TTL |
| `createBooking(input)` | Create `PENDING_PAYMENT` booking |
| `simulatePayment(input)` | Mark simulated payment success/failure |
| `cancelBooking(input)` | Cancel eligible booking |
| `adminCreateRoute(input)` | Create route |
| `adminCreateVehicle(input)` | Create vehicle |
| `adminCreateTrip(input)` | Create trip |
| `adminBlockSeats(input)` | Block seats from sale |
| `adminCheckIn(input)` | Check in passenger by booking/ticket code |

### Subscriptions

| Operation | Purpose |
|---|---|
| `seatStateChanged(tripId)` | Real-time seat state updates |
| `bookingUpdated(bookingCode)` | Booking status updates |

## 4. Core Data Objects

### Trip Search Result

```json
{
  "id": "trip-demo-001",
  "route": {
    "origin": "TP.HCM",
    "destination": "Da Lat"
  },
  "operatorName": "Phuong Trang Demo",
  "vehicleType": "sleeper_34",
  "departureTime": "2026-06-20T20:00:00+07:00",
  "arrivalTime": "2026-06-21T03:30:00+07:00",
  "price": 280000,
  "availableSeats": 12
}
```

### Seat

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

Allowed seat status:

```text
AVAILABLE
HELD
BOOKED
BLOCKED
```

### Booking

```json
{
  "bookingCode": "BK202606200001",
  "status": "PENDING_PAYMENT",
  "tripId": "trip-demo-001",
  "email": "guest@example.com",
  "totalAmount": 560000,
  "seats": ["A01", "A02"],
  "tickets": []
}
```

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

## 5. Standard Error Codes

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

## 6. gRPC Services

Proto sources:

```text
proto/trip.proto
proto/seat_inventory.proto
proto/booking.proto
```

### Trip Service

| RPC | Purpose |
|---|---|
| `AutocompleteLocations` | Suggest provinces/stations |
| `SearchTrips` | Search trips |
| `GetTripDetail` | Get trip details |
| `ListPopularRoutes` | Return popular routes |

### Seat Inventory Service

| RPC | Purpose |
|---|---|
| `GetSeatMap` | Get current seat states |
| `HoldSeats` | Hold seats atomically with Redis TTL |
| `ReleaseHold` | Release hold |
| `ConfirmSeats` | Convert held seats to booked |
| `BlockSeats` | Admin blocks seats |

### Booking Service

| RPC | Purpose |
|---|---|
| `CreateBooking` | Create booking from hold token and passengers |
| `GetBookingStatus` | Lookup with booking code and email |
| `SimulatePayment` | Simulate payment result |
| `CancelBooking` | Cancel eligible booking |
| `CheckInPassenger` | Admin/staff check-in |

## 7. Events

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

## 8. MCP Server Contract

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

## 9. Frontend Integration Rules

Frontend must:

1. Use GraphQL operations instead of direct service calls.
2. Handle loading, error, empty, success, and expired-hold states.
3. Display countdown from `hold.expiresAt`.
4. Ask for booking code and email before private booking lookup.
5. Treat GraphQL `UNAUTHORIZED` as a login/session issue.

## 10. Contract Change Rule

When changing API behavior, update all affected files:

```text
docs/API_CONTRACT.md
graphql/schema.graphql
proto/*.proto
docs/ARCHITECTURE.md if boundary changes
docs/DATABASE_SCHEMA.md if persistence changes
```

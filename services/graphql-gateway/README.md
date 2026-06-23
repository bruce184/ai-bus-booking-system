# GraphQL Gateway

Owns public GraphQL schema, demo auth context, orchestration, and subscriptions.

Current status:

```text
B-1 scaffold exists. The gateway can start, load the shared GraphQL schema, and prepare gRPC clients from the proto contracts.
Business resolvers are intentionally still pending for the later B-2, B-4, and B-5 tasks.
```

## Local Commands

Install dependencies from this folder before running service scripts:

```bash
npm install
```

Run in watch mode:

```bash
npm run dev
```

From the repository root:

```bash
npm run dev:gateway
npm run typecheck:gateway
npm run build:gateway
```

Default endpoint:

```text
http://localhost:4000/graphql
```

Must expose:

- Public/customer search, seat, checkout, booking, and saved-passenger operations
- Admin route/stop/vehicle/trip/booking/check-in/analytics/event-log operations
- Seat and booking subscriptions
- AI chatbot tool endpoints when the AI task is assigned

Source contract:

```text
graphql/schema.graphql
docs/API_CONTRACT.md
```

Internal service calls should use gRPC.

The B-1 scaffold creates gRPC client stubs for:

```text
TripService              -> proto/trip.proto
BookingService           -> proto/booking.proto
SeatInventoryService     -> proto/seat_inventory.proto
```

# GraphQL Gateway

Owns public GraphQL schema, demo auth context, orchestration, and subscriptions.

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

## Seat Inventory Resolvers

Task `Q-7` adds a minimal seat resolver module that can be imported by the
future GraphQL server scaffold:

```text
src/modules/seat/seatResolvers.ts
```

Implemented GraphQL contract operations:

- `Query.seatMap(tripId)`
- `Mutation.holdSeats(input)`
- `Mutation.releaseSeatHold(input)`
- `Subscription.seatStateChanged(tripId)`

The resolver module calls `SeatInventoryService` over gRPC using
`proto/seat_inventory.proto`.

Task `Q-8` adds an in-memory PubSub adapter for `seatStateChanged(tripId)`.
`holdSeats` publishes seat state changes returned by Seat Inventory Service.
The future GraphQL WebSocket server can attach the exported subscription
resolver directly.

Configuration:

```text
SEAT_INVENTORY_GRPC_URL=localhost:50053
```

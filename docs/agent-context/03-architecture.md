# Architecture Context

Read `docs/ARCHITECTURE.md` for the full source of truth.

## Short Version

```text
Next.js Web
  -> GraphQL Gateway
  -> gRPC Services
  -> PostgreSQL / Redis / RabbitMQ / Kafka
```

## Important Boundaries

- GraphQL Gateway owns public operations and subscriptions.
- Trip Service owns catalog/search data.
- Seat Inventory Service owns seat map state, Redis holds, and confirmation.
- Booking Service owns booking state transitions.
- Payment Service owns simulated payment only.
- Workers consume RabbitMQ workflow events.
- Analytics Service consumes Kafka events.
- MCP Server exposes approved tools/resources to external AI clients.

Trip Service may read the analytics search-count projection for its public
popular-route catalog, but Analytics Service remains the sole aggregate writer.

## Do Not Bypass

- Frontend must not call internal gRPC services directly.
- Chatbot must not invent trips or booking status.
- Seat hold must not be frontend-only.
- Booking state transitions must not be duplicated across unrelated services.
- Admin CRUD must stay in the service that owns the underlying domain data.
- Admin input normalization is shared across web/Gateway/Trip boundaries, but
  Trip Service remains authoritative and PostgreSQL repeats durable invariants.
- Trip status changes use only `adminUpdateTripStatus`; generic trip CRUD
  cannot skip or reverse the documented state transitions.

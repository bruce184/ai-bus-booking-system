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

## Do Not Bypass

- Frontend must not call internal gRPC services directly.
- Chatbot must not invent trips or booking status.
- Seat hold must not be frontend-only.
- Booking state transitions must not be duplicated across unrelated services.
- Admin CRUD must stay in the service that owns the underlying domain data.

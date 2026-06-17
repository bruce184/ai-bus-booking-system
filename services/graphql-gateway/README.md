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

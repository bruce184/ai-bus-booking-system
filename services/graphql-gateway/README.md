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

Current Module 5 scaffold:

- `src/resolvers/analyticsResolvers.js` implements `adminRevenueSummary`, `adminAnalyticsDashboard`, and `popularRoutes`.
- The temporary HTTP runner in `src/index.js` executes those analytics queries only, so the team can demo TN-5 before the full GraphQL runtime is added.
- Admin analytics requires demo header `x-demo-role: ADMIN`.

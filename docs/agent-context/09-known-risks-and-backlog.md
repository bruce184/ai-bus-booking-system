# Known Risks and Backlog

Use this file to orient future tasks. Out-of-scope issues found during implementation should be recorded in the completion report.

## Known Risks

- Microservices scope can grow too large for a student deadline.
- GraphQL/gRPC/event/database contracts can drift if docs are not updated.
- Seat hold race conditions need careful Redis atomic operations.
- AI chatbot may hallucinate if not forced to use tools.
- Running Kafka locally can be heavy on some laptops.
- Contract scope is now broad enough for the teacher spec; implementation tasks should be split carefully.
- The local demo uses one PostgreSQL instance and still shares read/projection
  access for Ticket/Email Workers, `trip_seats`, and `event_logs`. Physical
  database-per-service deployment would require event snapshots/APIs for those
  paths; current docs describe this honestly instead of claiming full storage
  isolation.

## Suggested Backlog

- The gateway's gRPC circuit breaker (`services/graphql-gateway/src/grpc/call.js`)
  fails fast once a downstream is open, but there is no generic fallback
  response behind it - a real fallback would need a different shape per call
  (cached trips for search vs. nothing sensible for booking/payment), and
  fabricating booking/payment data on failure would contradict the "never
  invent booking status or payment state" rule already in
  `docs/agent-context/07-security-privacy.md`. Revisit per-endpoint if a
  specific read path (e.g. search) wants stale-cache-on-failure.
- Add code generation for GraphQL and gRPC types.
- Add lightweight monitoring/health page.
- Add contract validation for GraphQL schema/proto drift.

# Known Risks and Backlog

Use this file to orient future tasks. Out-of-scope issues found during implementation should be recorded in the completion report.

## Known Risks

- Microservices scope can grow too large for a student deadline.
- GraphQL/gRPC/event/database contracts can drift if docs are not updated.
- Seat hold race conditions need careful Redis atomic operations.
- AI chatbot may hallucinate if not forced to use tools.
- MCP admin tools need auth decisions before production-like use.
- Running Kafka locally can be heavy on some laptops.
- Contract scope is now broad enough for the teacher spec; implementation tasks should be split carefully.
- Full demo seed data is not complete in the baseline seed file yet.

## Suggested Backlog

- The gateway's gRPC circuit breaker (`services/graphql-gateway/src/grpc/call.js`)
  fails fast once a downstream is open, but there is no generic fallback
  response behind it - a real fallback would need a different shape per call
  (cached trips for search vs. nothing sensible for booking/payment), and
  fabricating booking/payment data on failure would contradict the "never
  invent booking status or payment state" rule already in
  `docs/agent-context/07-security-privacy.md`. Revisit per-endpoint if a
  specific read path (e.g. search) wants stale-cache-on-failure.
- Add service scaffolds with package scripts.
- Add code generation for GraphQL and gRPC types.
- Add integration test for two users holding the same seat.
- Add demo seed generator.
- Add lightweight monitoring/health page.
- Add contract validation for GraphQL schema/proto drift.
- Expand database seed to the full teacher-spec demo set.

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

- Add service scaffolds with package scripts.
- Add code generation for GraphQL and gRPC types.
- Add integration test for two users holding the same seat.
- Add demo seed generator.
- Add lightweight monitoring/health page.
- Add contract validation for GraphQL schema/proto drift.
- Expand database seed to the full teacher-spec demo set.

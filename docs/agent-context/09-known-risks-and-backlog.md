# Known Risks and Backlog

Use this file to orient future tasks. Use `docs/implementation/handoff/issues_backlog.md` for concrete out-of-scope issues found during implementation.

## Known Risks

- Microservices scope can grow too large for a student deadline.
- GraphQL/gRPC/event/database contracts can drift if docs are not updated.
- Seat hold race conditions need careful Redis atomic operations.
- AI chatbot may hallucinate if not forced to use tools.
- MCP admin tools need auth decisions before production-like use.
- Running Kafka locally can be heavy on some laptops.

## Suggested Backlog

- Add service scaffolds with package scripts.
- Add code generation for GraphQL and gRPC types.
- Add integration test for two users holding the same seat.
- Add demo seed generator.
- Add lightweight monitoring/health page.

# Common Rules for Agents

1. Treat the member's local repository as the current implementation state.
2. Implement only the assigned task.
3. Do not add unrelated screens, services, endpoints, tables, packages, or architecture changes.
4. Do not change GraphQL/gRPC/database/event/MCP contracts silently.
5. Update source-of-truth docs when behavior changes.
6. Never commit secrets, `.env`, provider keys, passwords, tokens, or real customer data.
7. If a command takes longer than about 30 seconds, report progress and ask the member to run it if needed.
8. If an issue is outside scope, report it instead of fixing it silently.
9. End with the required completion report.

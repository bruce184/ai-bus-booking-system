# Decisions

Record project decisions that affect implementation.

## Baseline Decisions

| Date | Decision | Reason |
|---|---|---|
| 2026-06-17 | Use `main` as stable/demo branch | Simpler student workflow and easier PR review |
| 2026-06-17 | Keep contracts in `graphql/`, `proto/`, and `docs/API_CONTRACT.md` | Prevent frontend/service drift |
| 2026-06-17 | Use Redis TTL as temporary seat hold source of truth | Required by spec and prevents double booking |
| 2026-06-17 | Use RabbitMQ for workflow events and Kafka for analytics events | Matches required stack and separates concerns |

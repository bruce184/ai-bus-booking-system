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

- **Correlation ID - done (2026-07-17).** `packages/shared/src/correlation.js`
  wraps `node:async_hooks` so a request-scoped id needs no new parameter at
  existing call sites. The gateway mints/accepts `x-correlation-id` at the
  edge (Express middleware in `src/index.js`), attaches it as gRPC metadata
  on outbound calls (`grpc/call.js`, and each service's own client files),
  and it rides along in HTTP calls (payment/analytics `/popular-routes`) via
  the same header. Every gRPC server's shared handler wrapper
  (booking-service/seat-inventory-service's `handle()`, trip-service's
  `wrap()`) extracts it from inbound metadata. Event envelopes
  (`createEventEnvelope`) and the outbox (`outbox_events.correlation_id`
  column) persist it across the async gap between a transactional write and
  the poller's later publish, and every RabbitMQ workflow consumer plus
  analytics-service's Kafka consumer re-establish the scope from
  `event.correlationId` before handling the message - so ticket-worker,
  email-worker, and analytics-service's handlers all see it without their
  own changes. Not covered: mcp-server's own outbound calls (read-only
  chatbot tool calls; lower stakes per `docs/agent-context/07-security-privacy.md`).
- **`/health` endpoints - done (2026-07-17).** trip-service, booking-service,
  seat-inventory-service, ticket-worker, and email-worker now each run a
  minimal HTTP liveness endpoint (`packages/shared/src/health.js`) on a
  dedicated `*_HEALTH_PORT` (see `.env.example`), since they don't otherwise
  run an HTTP server. Still true: `docker-compose.yml` doesn't orchestrate
  any Node service (only infra - postgres/redis/rabbitmq/kafka - has
  healthchecks), so these endpoints are ready for a container `HEALTHCHECK`
  but nothing wires them up yet.
- **Dockerfile/.dockerignore - done (2026-07-17).** Every service under
  `services/*` and worker under `workers/*` (9 total) has a multi-stage
  Dockerfile (build context = repo root, for npm workspace access to
  `packages/shared` and `proto/`) plus a root `.dockerignore`. Verified with
  real `docker build` (all 9) and one `docker run` (trip-service, confirmed
  `@bus/shared` resolves correctly and the app runs up to its Postgres
  connection retry, as expected with no network). Not covered: `apps/web`
  (Next.js frontend - a materially different build, e.g. `next build`
  standalone output), wiring these images into `docker-compose.yml` as
  orchestrated services, and seat-inventory-service's separate
  `consume:booking-expired` process (noted in its Dockerfile - would need its
  own CMD/container).
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

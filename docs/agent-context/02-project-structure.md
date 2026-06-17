# Project Structure

## Root Areas

```text
apps/web/                    Next.js frontend
services/graphql-gateway/    GraphQL API gateway and subscriptions
services/trip-service/       Trip catalog/search service
services/seat-inventory-service/ Seat map, holds, Redis TTL
services/booking-service/    Booking state machine
services/payment-service/    Payment simulation
services/analytics-service/  Kafka consumers and aggregate reports
services/mcp-server/         MCP tools/resources
workers/ticket-worker/       Ticket generation
workers/email-worker/        Simulated email/log worker
packages/shared/             Shared constants/utilities
packages/contracts/          Generated/shared contracts later
graphql/                     GraphQL schema
proto/                       gRPC proto files
database/                    PostgreSQL schema and seed
infrastructure/              Nginx and service config
docs/                        Project source-of-truth docs
scripts/                     Helper scripts
```

## File Placement Rule

If a change spans more than one service or contract area, update the relevant docs in the same task.

The current repository is intentionally a baseline with mostly README files inside module folders. Future implementation tasks should add code files only inside their assigned module boundaries.

Examples:

- Adding a trip search field: update `graphql/schema.graphql`, `docs/API_CONTRACT.md`, and Trip Service code.
- Adding a seat hold field: update `proto/seat_inventory.proto`, `graphql/schema.graphql` if public, and API docs.
- Adding a table column: update `docs/DATABASE_SCHEMA.md`, `database/schema.sql`, seed if needed, and API docs if exposed.

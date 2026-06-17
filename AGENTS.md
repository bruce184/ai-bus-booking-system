# Agent Instructions - Intercity Bus Booking AI

This repository is a student microservices project for an intercity bus booking system with AI chatbot and MCP Server support.

## Tech Stack

- Frontend: Next.js
- API gateway: GraphQL with subscriptions
- Internal service calls: gRPC
- Services: Node.js microservices
- Messaging: RabbitMQ and Kafka
- Cache / seat hold: Redis
- Database: PostgreSQL
- Reverse proxy: Nginx
- AI: AI SDK tool calling
- External AI interface: MCP Server
- Local infrastructure: Docker Compose

## Read Before Coding

For any non-trivial task, read these files first:

1. `docs/agent-context/00-index.md`
2. `docs/DEV_WORKFLOW.md`
3. `docs/CODING_GUIDELINES.md`
4. `docs/API_CONTRACT.md` if the task touches GraphQL, gRPC, events, MCP tools, frontend integration, or service APIs
5. `docs/DATABASE_SCHEMA.md` if the task touches database schema, seed data, migrations, or persistence
6. `docs/README_SETUP.md` if the task touches setup, env, Docker, run commands, ports, or local demo
7. `docs/ARCHITECTURE.md` if the task changes service boundaries or data flow

## Strict Rules

1. Implement only the assigned task.
2. Do not add features outside MVP scope.
3. Do not add services, screens, GraphQL operations, gRPC methods, events, tables, packages, or infrastructure changes unless the assigned task explicitly requires them.
4. Do not silently change GraphQL, gRPC, database, event, or MCP contracts.
5. Keep service ownership boundaries clear.
6. Seat holding must go through Seat Inventory Service and Redis TTL, not direct frontend state.
7. Booking state changes must follow the documented booking state machine.
8. AI chatbot must call internal tools for trip and booking data; do not fabricate trip inventory or private booking details.
9. MCP booking status lookup must require booking code and email.
10. Do not commit secrets, `.env` files, provider keys, DB passwords, tokens, or real customer data.
11. Do not rewrite architecture without approval.
12. Keep changes small and focused.
13. If behavior is unclear, document assumptions or ask before changing scope.
14. If you find an issue outside the assigned task, record it in the completion report or `docs/implementation/handoff/issues_backlog.md`; do not fix it silently.

## Common Commands

```bash
npm run check:docs
docker compose config
```

Future service commands will be added as services are implemented.

## Completion Report

Every task must end with:

```text
Summary:
Files changed:
Implementation notes:
How to run:
How to test:
Docs updated:
Assumptions:
Blockers:
Out-of-scope issues found:
```

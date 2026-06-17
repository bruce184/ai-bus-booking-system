# Intercity Bus Booking AI

Intercity Bus Booking AI is a student microservices project for searching intercity bus trips, selecting seats, holding seats with Redis TTL, simulating checkout, issuing e-tickets, supporting admin operations, providing analytics, and exposing AI/MCP tools.

The repository is set up with a local-demo-first strategy. The baseline focuses on clear ownership, reviewable work, and source-of-truth contracts before feature implementation expands.

## Required Stack

| Layer | Technology |
|---|---|
| Web app | Next.js |
| API gateway | GraphQL |
| Internal service calls | gRPC |
| Services | Node.js microservices |
| Messaging | RabbitMQ and Kafka |
| Cache / seat hold | Redis |
| Reverse proxy | Nginx |
| AI | AI SDK with tool calling |
| External AI interface | MCP Server |
| Database | PostgreSQL |
| Container orchestration | Docker Compose |

## MVP Scope

The MVP includes:

- Public trip search and autocomplete
- Trip filters, sorting, detail page, and SEO route pages
- Seat map, seat hold, Redis TTL, and seat state updates
- Guest checkout and registered checkout
- Simulated payment
- E-ticket generation and simulated email notification
- Booking lookup by booking code and email
- Customer booking history
- Admin route, stop, vehicle, trip, booking, check-in, and revenue views
- Kafka analytics events and revenue/search summaries
- AI chatbot for policy Q&A, trip suggestions, and booking status lookup
- MCP Server tools for trip, booking, revenue, and popular route lookup

Out-of-scope unless approved:

- Real payment gateway
- Production SMS/email delivery
- Native mobile app
- Multi-tenant operator billing
- Real QR scanner hardware integration
- Production-grade observability stack

## Repository Structure

```text
intercity-bus-booking-ai/
+-- apps/web/                    # Next.js frontend
+-- services/graphql-gateway/    # Public GraphQL API and subscriptions
+-- services/trip-service/       # Routes, stops, vehicles, trips, search
+-- services/booking-service/    # Booking lifecycle and payment simulation
+-- services/seat-inventory-service/ # Seat state, Redis holds, gRPC API
+-- services/payment-service/    # Simulated payment boundary
+-- services/notification-service/ # Email/log notification boundary
+-- services/analytics-service/  # Kafka consumers and reporting aggregates
+-- services/mcp-server/         # MCP tools/resources for AI clients
+-- workers/ticket-worker/       # Ticket generation worker
+-- workers/email-worker/        # Simulated email worker
+-- packages/shared/             # Shared constants and helpers
+-- packages/contracts/          # Shared generated/typed contracts later
+-- graphql/                     # GraphQL schema source of truth
+-- proto/                       # gRPC proto source of truth
+-- database/                    # PostgreSQL schema and seed data
+-- infrastructure/              # Nginx, Redis, RabbitMQ, Kafka, PostgreSQL notes/config
+-- docs/                        # Team, Agent, setup, architecture, API docs
+-- scripts/                     # Helper scripts
+-- .env.example                 # Environment variable template
+-- AGENTS.md                    # Root AI Agent instructions
+-- package.json                 # Root helper scripts
```

## Quick Start

This baseline does not install full app dependencies yet. It prepares the repository for team work.

Check required documents:

```bash
npm run check:docs
```

View the planned local infrastructure:

```bash
docker compose config
```

When service implementations are added, the expected local URLs are:

```text
Web:              http://localhost:3000
GraphQL Gateway:  http://localhost:4000/graphql
GraphQL WS:       ws://localhost:4000/graphql
MCP Server:       http://localhost:4010/mcp
Nginx:            http://localhost:8080
```

## Project Documents

| File | Purpose |
|---|---|
| `AGENTS.md` | Root rules for AI Agents |
| `docs/agent-context/00-index.md` | Reading guide for Agent context files |
| `docs/README_SETUP.md` | Local setup, env, Docker, and demo guide |
| `docs/ARCHITECTURE.md` | Microservices boundaries and event flow |
| `docs/API_CONTRACT.md` | GraphQL, gRPC, REST-like service boundary, event, and MCP contract summary |
| `docs/DATABASE_SCHEMA.md` | PostgreSQL schema source of truth |
| `docs/CODING_GUIDELINES.md` | Branch, commit, PR, code, docs, and security rules |
| `docs/DEV_WORKFLOW.md` | Team assignment and AI Agent workflow |
| `docs/implementation/02_task_template.md` | Copy/paste task template for members and Agents |
| `docs/implementation/handoff/issues_backlog.md` | Backlog for issues outside assigned scope |

## AI Agent Workflow

Before assigning work to an AI Agent, include the assignment row and ask it to read:

```text
AGENTS.md
docs/agent-context/00-index.md
docs/DEV_WORKFLOW.md
docs/CODING_GUIDELINES.md
docs/prompts/00-agent-router.md
```

Agent rules:

- Implement only the assigned task.
- Do not change GraphQL, gRPC, database, event, or MCP contracts silently.
- Update the matching source-of-truth document in the same task when a contract changes.
- Do not add unrelated services, screens, packages, or architecture changes.
- Record out-of-scope findings in the completion report or backlog.
- Never commit `.env`, service credentials, tokens, passwords, or real customer data.

## Development Workflow

Use `main` as the stable/baseline/demo branch.

```bash
git checkout main
git pull origin main
git checkout -b <member>/<scope>
```

After implementation:

```bash
git status
git add .
git commit -m "feat(scope): short description"
git push -u origin <member>/<scope>
```

Open a Pull Request into `main`.

## Security Rules

Never commit:

- `.env`
- API keys
- Database passwords
- JWT secrets
- AI provider keys
- SMTP credentials
- Real user, booking, phone, or email data

Allowed to commit:

- `.env.example`
- Fake placeholder values
- Public setup instructions
- Fake demo seed data

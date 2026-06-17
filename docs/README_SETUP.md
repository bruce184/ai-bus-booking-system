# README SETUP - Intercity Bus Booking AI

## 1. Purpose

This file explains how to set up, run, verify, and demo the project locally.

Use this file when:

- A new team member clones the repository.
- A baseline owner prepares source for the team.
- A developer runs local infrastructure.
- An AI Agent needs setup context.

## 2. Project Summary

Intercity Bus Booking AI lets customers search trips, select seats, hold seats, checkout, receive e-tickets, and ask an AI chatbot for trip/policy/booking help. Admin users manage operations and reports. External AI clients can use the MCP Server tools.

Local demo is required. Online deployment is optional.

MVP modules:

```text
Trip Search and Catalog
Seat Inventory and Real-time Seat Hold
Booking, Payment Simulation, Ticket, Notification
Admin Operations
Analytics, AI Chatbot, MCP Server
```

## 3. Prerequisites

Install:

- Node.js 20 or newer
- npm
- Git
- Docker Desktop
- VS Code

Check versions:

```bash
node -v
npm -v
git --version
docker --version
docker compose version
```

## 4. Clone and Branch Setup

Use `main` as the stable/baseline/demo branch:

```bash
git checkout main
git pull origin main
git checkout -b <member>/<scope>
```

Examples:

```bash
git checkout -b hoang/baseline-repo
git checkout -b khoa/trip-service
git checkout -b quan/seat-inventory
git checkout -b thien/web-search-ui
git checkout -b toan/ai-mcp
```

No mandatory `dev` branch is required.

## 5. Repository Structure

```text
apps/web/                    Next.js frontend
services/graphql-gateway/    GraphQL API gateway and subscriptions
services/trip-service/       Routes, stops, vehicles, trips, search
services/booking-service/    Booking lifecycle
services/seat-inventory-service/ Seat state and Redis TTL holds
services/payment-service/    Payment simulation
services/notification-service/ Notification boundary
services/analytics-service/  Kafka consumers and aggregates
services/mcp-server/         MCP tools and resources
workers/ticket-worker/       Ticket generation from booking.paid
workers/email-worker/        Simulated email notification
packages/shared/             Shared constants/utilities
packages/contracts/          Generated contracts later
graphql/                     GraphQL schema
proto/                       gRPC proto files
database/                    SQL schema and seed
infrastructure/              Nginx and infra notes/config
docs/                        Source-of-truth docs
```

## 6. Environment Setup

Create local `.env` files from `.env.example` when services are implemented.

Do not commit real `.env` files.

Important local ports:

| Component | Port |
|---|---:|
| Web | 3000 |
| GraphQL Gateway | 4000 |
| MCP Server | 4010 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| RabbitMQ | 5672 / 15672 |
| Kafka | 9092 |
| Nginx | 8080 |

## 7. Local Infrastructure

Validate compose config:

```bash
npm run compose:config
```

Start infrastructure:

```bash
docker compose up -d postgres redis rabbitmq zookeeper kafka nginx
```

Stop infrastructure:

```bash
docker compose down
```

Use fake demo data only.

## 8. Baseline Verification

Run:

```bash
npm run check:docs
docker compose config
```

Expected:

- Required docs and contracts are present.
- Docker Compose config is valid.

## 9. Future Local Run Targets

When implementations exist, keep these commands updated:

```bash
npm run dev:web
npm run dev:gateway
npm run dev
```

Expected URLs:

```text
Web:              http://localhost:3000
GraphQL Gateway:  http://localhost:4000/graphql
MCP Server:       http://localhost:4010/mcp
Nginx:            http://localhost:8080
```

## 10. Demo Checklist

```text
[ ] Infrastructure starts
[ ] Database schema and seed are applied
[ ] Web app loads
[ ] Trip search works
[ ] Filters and sorting work
[ ] Trip detail shows pickup/dropoff/policy/seat map
[ ] holdSeats prevents double booking
[ ] Seat hold expires after TTL
[ ] Guest checkout creates PENDING_PAYMENT booking
[ ] Payment success confirms seats
[ ] Ticket worker creates ticket
[ ] Email worker logs simulated email
[ ] Booking lookup requires booking code and email
[ ] Admin CRUD and check-in demo work
[ ] Analytics dashboard shows fake demo summaries
[ ] Chatbot calls tools instead of inventing inventory
[ ] MCP tools return demo data
```

## 11. Common Problems

### Docker port already in use

Stop the conflicting service or change the port in `docker-compose.yml` and `.env`.

### Redis seat hold behavior is inconsistent

Check:

- `SEAT_HOLD_TTL_SECONDS`
- Seat key format in `docs/API_CONTRACT.md`
- Seat Inventory Service writes to Redis atomically

### GraphQL and gRPC contracts drift

Update:

- `graphql/schema.graphql`
- relevant `proto/*.proto`
- `docs/API_CONTRACT.md`
- frontend/service code in the same task

## 12. Baseline Owner Checklist

```text
[ ] Root docs exist
[ ] Agent context exists
[ ] GraphQL schema exists
[ ] gRPC proto files exist
[ ] Database schema and seed files exist
[ ] Docker Compose config validates
[ ] .env.example has placeholders only
[ ] Branch/PR workflow is documented
[ ] Task template exists
[ ] Backlog/handoff docs exist
```

## 13. Security Rules

Never commit:

- `.env`
- API keys
- Database passwords
- AI provider keys
- SMTP credentials
- Real booking/customer/passenger data

Before commit:

```bash
git status
git diff --cached
```

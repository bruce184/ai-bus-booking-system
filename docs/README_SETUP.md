# README SETUP - AI Bus Booking System

## 1. Purpose

This file explains how to set up, run, verify, and demo the project locally.

Use this file when:

- A new team member clones the repository.
- A baseline owner prepares source for the team.
- A developer runs local infrastructure.
- An AI Agent needs setup context.

## 2. Project Summary

AI Bus Booking System lets customers search trips, select seats, hold seats, checkout, receive e-tickets, and ask an AI chatbot for trip/policy/booking help. Admin users manage routes, stops, vehicles, seat layouts, trips, bookings, check-in, seat blocks, logs, and reports. External AI clients can use the MCP Server tools.

Current repository status:

```text
The merged MVP modules include the GraphQL Gateway, Next.js web app, Trip Service, Seat Inventory Service, Booking Service, Payment Service, Ticket Worker, Email Worker, Analytics Service, web AI chatbot route, MCP Server runtime, demo auth, admin wiring, and test harnesses.
```

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

Create local `.env` files from `.env.example` for local service runs.
Set `FLOW_CONTEXT_SECRET` to a distinct random value outside the disposable
local demo; it encrypts the short-lived checkout/payment/lookup context cookie.

Do not commit real `.env` files.

Important local ports:

| Component | Port |
|---|---:|
| Web | 3000 |
| GraphQL Gateway | 4000 |
| MCP Server | 4010 |
| Analytics Service HTTP | 50056 |
| Trip Service gRPC | 50051 |
| Seat Inventory Service gRPC | 50052 |
| Booking Service gRPC | 50053 |
| Payment Service HTTP | 5010 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| RabbitMQ | 5672 / 15672 |
| Kafka | 9092 |
| Nginx | 8080 |

## 7. Local Infrastructure

Install workspace dependencies:

```bash
npm install
```

Validate compose config:

```bash
npm run compose:config
```

Start infrastructure:

```bash
docker compose up -d postgres redis rabbitmq zookeeper kafka nginx
```

`npm run infra:up` uses Compose `--wait` and returns only after configured
health checks pass. `npm run dev:all` prints the READY banner only after HTTP
and TCP probes confirm the application services, rather than after a fixed
sleep.

Stop infrastructure:

```bash
docker compose down
```

Reset and MCP demo commands:

```bash
npm run demo:reset:data  # canonical SQL seed + Redis; stop services first
npm run demo:reset       # safest reset: recreates every infra volume
npm run demo:mcp         # official SDK lifecycle against the running MCP server
```

Use fake demo data only.

The B-3 seed includes deterministic fake data for the local demo:

```text
3 users, 12 locations/stations, 3 vehicle layouts, 5 routes, 20 trips
(12 historical/state examples + 8 rolling upcoming demo trips),
8 bookings, 6 tickets, saved passengers, event logs, and 7 analytics rows.
```

If the local PostgreSQL volume was created before B-3, Docker will not rerun `database/seed.sql` automatically. For a disposable local demo database, reset the compose volume before starting Postgres again.

## 8. Baseline Verification

Run:

```bash
npm run check:docs
docker compose config
```

Expected:

- Required docs and contracts are present.
- Docker Compose config is valid.

On Windows PowerShell, if `npm run check:docs` is blocked by execution policy, use:

```bash
npm.cmd run check:docs
```

Implemented test targets:

| Target | Command | Notes |
|---|---|---|
| Gateway unit / whitebox | `npm run test:gateway` | Auth, JWT, role helpers, and context factory |
| Gateway integration | `npm run test:gateway:integration` | Starts a real gateway on port `4100` and calls GraphQL over HTTP |
| Booking service unit | `npm run test:booking` | Booking state machine and service client request contracts |
| Seat Inventory unit | `npm run test:seat` | ACTIVE-trip guard, post-write race rollback, Redis hold lifecycle, and persistent seat invariants |
| Payment service unit | `npm run test:payment` | Payment result and Kafka-outage isolation |
| Email worker unit | `npm run test:email-worker` | Consumer idempotency and normalized simulated delivery |
| Trip service unit | `npm run test:trip` | Sort aliases and popular-route aggregate mapping |
| Analytics service unit | `npm run test:analytics` | Canonical and legacy search-event envelope compatibility |
| Search analytics integration | `npm run test:analytics:integration` | Requires PostgreSQL, Kafka, and Analytics Service; bounded to 15 seconds and cleans test data |
| Gateway API / contract smoke | `npm run test:gateway:api` | Requires a gateway already running on `http://localhost:4000/graphql` |
| Gateway performance | `npm run test:gateway:perf` | Requires Apache JMeter on `PATH` |
| Web lint | `npm --prefix apps/web run lint` | Next.js/React lint |
| Web auth/flow unit tests | `npm run test:web:unit` | BFF portal-role, encrypted flow-context, expiry, tamper rejection, and no-sensitive-URL invariants |
| Web admin/customer E2E | `npm run test:web:e2e` | Uses isolated Compose ports/volume, starts non-reused app servers, and always removes E2E infrastructure in a final cleanup step |
| Source integrity | `npm run check:source` | Syntax-checks non-Next Node files, resolves relative imports, rejects raw runtime `fetch()` without the shared deadline wrapper, and validates dependencies; Next JSX is covered by lint/build |
| Full release gate | `npm run release:check` | Runs docs/source/Compose checks, unit and integration suites, then the hermetic web E2E suite |

The E2E wrapper uses a dedicated Compose project, disposable database volume,
and non-default host ports. It always executes `docker compose down -v
--remove-orphans`, including after Playwright failure. Override ports only
with `E2E_*_PORT`; ordinary demo ports remain unchanged.

## 9. Local Run Targets

GraphQL Gateway:

```bash
npm install --prefix services/graphql-gateway
npm run dev:gateway
```

Core local services:

```bash
npm run dev:web
npm run dev:gateway
npm run dev:trip
npm run dev:seat
npm run dev:seat-consumer
npm run dev:analytics
npm run dev:mcp
npm run dev:booking
npm run dev:payment
npm run dev:ticket-worker
npm run dev:email-worker
```

The Gateway realtime bridge requires RabbitMQ in the integrated demo. Gateway
unit/integration tests and intentionally isolated local runs must set
`DISABLE_RABBITMQ=true`; this disables cross-process subscription propagation
and must not be used for the full demo.

For local service-only smoke tests without RabbitMQ/Kafka/Seat Inventory running, use:

```bash
DISABLE_RABBITMQ=true DISABLE_KAFKA=true SKIP_SEAT_CONFIRMATION=true npm run dev:booking
```

Do not use `SKIP_SEAT_CONFIRMATION=true` for the full integrated demo; it exists only for isolated Module 3 development before the Seat Inventory Service is available.

Demo auth users:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `admin123` |
| Staff | `staff@example.com` | `staff123` |
| Customer | `customer@example.com` | `customer123` |

Expected URLs:

```text
Web:              http://localhost:3000
GraphQL Gateway:  http://localhost:4000/graphql
Booking gRPC:      localhost:50053
Payment Service:   http://localhost:5010
Analytics Service: http://localhost:50056/health
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
[ ] Empty search suggests nearby dates
[ ] SEO metadata exists for popular route pages
[ ] Trip detail shows pickup/dropoff/policy/seat map
[ ] holdSeats prevents double booking
[ ] Seat hold expires after TTL
[ ] Seat state changes are broadcast to other clients
[ ] Guest checkout creates PENDING_PAYMENT booking
[ ] Registered checkout links booking to user
[ ] Registered customer can save passenger profiles
[ ] Payment success confirms seats
[ ] Ticket worker creates ticket
[ ] Ticket content includes booking code, ticket code, passenger, route, pickup/dropoff, departure, seat, vehicle, QR payload, and check-in policy
[ ] Email worker logs simulated email
[ ] Booking lookup requires booking code and email
[ ] Admin login works
[ ] Admin CRUD for routes, stops, vehicles, seat layouts, and trips works
[ ] Admin can activate/lock/depart/complete trips
[ ] Admin can block seats from sale
[ ] Admin can list bookings by trip/status
[ ] Admin/staff check-in works by booking code, ticket code, or simulated QR payload
[ ] Admin event logs show main actions
[ ] Analytics dashboard shows revenue by day, tickets by route, popular routes, and booking success rate
[ ] Chatbot calls tools instead of inventing inventory
[ ] Chatbot cites internal policy resources
[ ] Chatbot refuses booking details without booking code and email
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

### HTTP request times out

The shared deadline defaults to 5 seconds. For a deliberately slower local
environment, set `HTTP_REQUEST_TIMEOUT_MS` (100..120000 ms) consistently
before starting the affected processes; do not replace the shared wrapper with
an unbounded `fetch()`.

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
[ ] README states which modules are implemented and which assigned modules are still pending
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

# DEV WORKFLOW - Intercity Bus Booking AI

## 1. Purpose

This file is the main workflow guide for team members and AI Agents.

It explains how to:

- Read the right documents
- Pick up assigned tasks
- Create branches
- Implement within MVP scope
- Verify locally
- Report completion
- Avoid AI Agent scope drift

## 2. Project Context

| Item | Value |
|---|---|
| Project name | Intercity Bus Booking AI |
| Product type | Microservices web app |
| Main users | Guest customer, registered customer, admin, check-in staff |
| Main goal | Book intercity bus tickets with AI and MCP support |
| Demo strategy | Local demo required; online deploy optional |
| Stable branch | `main` |

MVP modules:

```text
Trip Search and Catalog
Seat Inventory and Real-time Seat Hold
Booking, Payment Simulation, Ticket, Notification
Admin Operations
Analytics, AI Chatbot, MCP Server
```

Current baseline status:

```text
The B-1 GraphQL Gateway scaffold and B-2 demo auth exist.
The B-3 deterministic database seed exists for local demo data.
Members should add files/folders only inside their assigned module after task assignment.
Contracts and source-of-truth docs define the required behavior before feature code exists.
```

## 3. Required Docs

| File | Purpose |
|---|---|
| `AGENTS.md` | Root rules for AI Agents |
| `docs/agent-context/00-index.md` | Agent reading guide |
| `docs/README_SETUP.md` | Local setup, env, Docker, troubleshooting |
| `docs/ARCHITECTURE.md` | Service boundaries and workflows |
| `docs/API_CONTRACT.md` | GraphQL, gRPC, events, MCP contracts |
| `docs/DATABASE_SCHEMA.md` | Database schema and seed source of truth |
| `docs/CODING_GUIDELINES.md` | Code, branch, commit, PR, security rules |
| `docs/implementation/02_task_template.md` | Copy/paste task template |
| `docs/prompts/00-agent-router.md` | Parent prompt for role-based AI Agent workflows |

## 4. Assignment Task Input

Each task should come from the assignment sheet.

Expected assignment sheet fields:

```text
Feature group:
Feature/task:
Owner:
Status:
Output expected:
Priority:
Deadline:
Notes:
```

Optional fields:

```text
Allowed files/area:
Acceptance criteria:
Verification required:
Branch:
Task ID:
```

If optional fields are missing, infer conservatively. If scope overlaps another member or requires contract/schema changes outside the assigned task, stop and ask before coding.

Status values:

```text
Not started
In progress
Review
Done
Blocked
```

Priority values:

```text
Must
Should
Could
```

## 5. Standard Development Flow

1. Read the assigned row.
2. Read the relevant docs.
3. Pull latest `main`.
4. Create a branch using `<member>/<scope>`.
5. Implement only the assigned scope.
6. Run relevant local verification.
7. Update docs if API/schema/setup/workflow changed.
8. Update assignment sheet status/note.
9. Push branch.
10. Open Pull Request into `main`.

Commands:

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

## 6. Scope By Area

| Assignment area | Normal scope |
|---|---|
| Frontend | `apps/web/`, GraphQL client docs if needed |
| GraphQL Gateway | `services/graphql-gateway/`, `graphql/schema.graphql`, API docs |
| Trip Service | `services/trip-service/`, `proto/trip.proto`, route/stop/vehicle/trip database/API docs |
| Seat Inventory | `services/seat-inventory-service/`, `proto/seat_inventory.proto`, Redis docs |
| Booking | `services/booking-service/`, `proto/booking.proto`, booking/passenger/ticket DB/API docs |
| Payment | `services/payment-service/`, payment events/API docs |
| Workers | `workers/`, RabbitMQ event docs |
| Analytics | `services/analytics-service/`, Kafka event docs, analytics aggregate docs |
| AI Chatbot | `apps/web/` and gateway tool APIs |
| MCP Server | `services/mcp-server/`, MCP section in API docs |
| Database | `database/`, `docs/DATABASE_SCHEMA.md` |
| Infrastructure | `docker-compose.yml`, `infrastructure/`, setup docs |

## 7. Local Verification

Baseline:

```bash
npm run check:docs
docker compose config
```

Minimum verification by task type:

| Task type | Verification |
|---|---|
| Docs/setup | `npm run check:docs` |
| Docker/infra | `docker compose config` |
| GraphQL Gateway unit/auth | `npm run test:gateway` |
| GraphQL Gateway integration | `npm run test:gateway:integration` |
| GraphQL API smoke | `npm run test:gateway:api` with gateway running |
| GraphQL performance | `npm run test:gateway:perf` when Apache JMeter is installed |
| gRPC | Proto lint/generation once tooling exists |
| Database | Apply schema to local Postgres once migrations exist |
| Frontend | `npm run test:web:e2e` for admin E2E when browser dependencies are installed |
| Worker | Unit/manual event test once worker exists |

## 8. Module Ownership Suggestions

Suggested team split:

| Module | Suggested owner scope |
|---|---|
| Baseline repo and docs | PM / baseline owner |
| Web search and checkout UI | Frontend owner |
| GraphQL Gateway | API owner |
| Trip/search service | Backend owner |
| Seat inventory and Redis | Backend owner |
| Booking/payment/ticket flow | Backend owner |
| Admin operations | Full-stack owner |
| Analytics dashboard | Data/backend owner |
| AI chatbot and MCP Server | AI/backend owner |
| QA/demo | QA owner |

Suggested finer-grained split when the team is ready:

| Spec module | Suggested task slice |
|---|---|
| Module 1 | Search UI, SEO route pages, Trip Service search/catalog, Redis search cache, search analytics event |
| Module 2 | Seat map UI, hold countdown, Seat Inventory Service, Redis TTL atomic hold, subscription updates, double-booking test |
| Module 3 | Checkout UI, Booking Service, Payment simulation, Ticket Worker, Email Worker, customer booking lookup/history |
| Module 4 | Admin UI, demo auth, route/stop/vehicle/trip CRUD, trip status, seat block, check-in, event log |
| Module 5 | Analytics consumer/dashboard, AI SDK chatbot tools/resources, MCP Server tools/resources |

## 9. Agent Scope Lock

Every AI Agent task must identify:

```text
Assigned task:
Owner or member:
Feature/module:
Expected output:
Required docs:
Verification required:
```

Agent must not:

- Add unrelated features.
- Add screens/endpoints/services/tables/packages outside the assigned task.
- Change contracts silently.
- Modify unrelated files.
- Commit secrets.
- Delete user/team work without confirmation.
- Fix out-of-scope issues silently.

## 10. Required Completion Report

After finishing a task, report:

```text
Summary:
Files changed:
Implementation notes:
How to run:
How to test:
Docs updated:
Assignment sheet update:
Assumptions:
Blockers:
Out-of-scope issues found:
```

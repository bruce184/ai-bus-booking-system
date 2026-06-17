# CODING GUIDELINES - Intercity Bus Booking AI

## 1. Purpose

This document defines coding, Git, pull request, review, docs, and AI-assisted development rules.

Use it with:

- `AGENTS.md`
- `docs/agent-context/00-index.md`
- `docs/DEV_WORKFLOW.md`
- `docs/API_CONTRACT.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/README_SETUP.md`
- `docs/implementation/02_task_template.md`

## 2. Project Principles

| Principle | Rule |
|---|---|
| MVP first | Implement assigned demo tasks only |
| Contract first | GraphQL, gRPC, event, and MCP behavior follows `docs/API_CONTRACT.md` |
| Service ownership | Each service owns a clear domain |
| Local demo first | Do not break documented local setup |
| Secure by default | Do not expose secrets or real customer data |
| Task-focused PRs | One branch covers one assigned task/scope |
| Scope lock | Report out-of-scope issues instead of fixing silently |

## 3. Branch Strategy

| Branch pattern | Purpose |
|---|---|
| `main` | Stable baseline/demo branch |
| `<member>/<scope>` | Member task branch |
| `fix/<bug-name>` | Bug fix |
| `docs/<topic>` | Documentation |
| `chore/<topic>` | Setup/config/maintenance |

Rules:

1. Do not commit directly to `main` unless approved.
2. Create branches from latest `main`.
3. Open Pull Requests back into `main`.
4. Keep branch scope aligned with the assignment sheet.

## 4. Commit Rules

Use Conventional Commit format:

```text
<type>(<scope>): <short description>
```

Examples:

```bash
git commit -m "chore(baseline): initialize repo docs"
git commit -m "feat(search): add trip search query"
git commit -m "feat(seat): add holdSeats grpc method"
git commit -m "docs(api): update booking contract"
```

Allowed types:

```text
feat
fix
docs
style
refactor
test
chore
```

Common scopes:

```text
baseline
setup
web
gateway
trip
seat
booking
payment
ticket
email
admin
analytics
ai
mcp
db
infra
docs
```

## 5. Pull Request Rules

Every PR should include:

- Assignment/task name
- Owner
- Summary of changes
- Files/areas changed
- How to run
- How to test
- Screenshots if UI changed
- Docs updated if API/schema/setup/workflow changed
- Known issues or assumptions

## 6. Code Style

Project language:

```text
TypeScript preferred for implementation, JavaScript allowed for small scripts
```

Rules:

1. Use small modules with clear domain ownership.
2. Validate input at service boundaries.
3. Do not duplicate business rules across services without documenting the source of truth.
4. Avoid direct database access from the frontend.
5. Use GraphQL Gateway for web-facing operations.
6. Use gRPC for internal service calls.
7. Use Redis for temporary seat holds.
8. Use RabbitMQ for workflow events and Kafka for analytics events.
9. Use fake demo data only.
10. If a required implementation file/folder does not exist yet, create it only inside the assigned module.

## 7. Frontend Guidelines

Expected area:

```text
apps/web/
```

Rules:

1. Use Next.js routes/pages according to the implementation choice.
2. Show loading, empty, error, success, and expired-hold states.
3. Use GraphQL client functions instead of scattered raw fetch calls.
4. Seat map must show `AVAILABLE`, `HELD`, `BOOKED`, `BLOCKED`.
5. Checkout must require passenger details per seat.
6. Booking lookup must require booking code and email.
7. Search results must support empty-state nearby-date suggestions.
8. Route pages must support SEO metadata for popular routes.
9. Keep screens responsive for laptop and mobile demo.

## 8. Backend / Service Guidelines

Expected areas:

```text
services/
workers/
packages/
```

Rules:

1. Keep service boundaries aligned with `docs/ARCHITECTURE.md`.
2. Validate gRPC and GraphQL request fields.
3. Return stable error codes from `docs/API_CONTRACT.md`.
4. Publish documented events only.
5. Keep idempotency in payment/ticket/email worker tasks where possible.
6. Do not invent live data in AI or MCP responses.
7. Ticket output must include the fields documented in `docs/API_CONTRACT.md`.
8. Admin operations must respect role boundaries and service ownership.

## 9. Database Rules

Source of truth:

```text
docs/DATABASE_SCHEMA.md
database/schema.sql
database/seed.sql
```

Rules:

1. Use UUID primary keys.
2. Store only fake demo data in seed.
3. Keep booking code and ticket code unique.
4. Do not commit real PII.
5. Update docs when schema changes.

## 10. AI and MCP Rules

1. Chatbot must use tools for trip and booking data.
2. Policy answers should reference internal policy resources.
3. Booking status requires booking code and email.
4. Admin analytics tools must be admin-only when auth is implemented.
5. Do not hallucinate seat availability, payment state, or revenue.

## 11. Local Verification

Baseline:

```bash
npm run check:docs
docker compose config
```

When services are implemented, add service-specific checks to this file and `docs/DEV_WORKFLOW.md`.

## 12. Documentation Workflow

Update docs when:

| Change | Required update |
|---|---|
| GraphQL field/operation | `docs/API_CONTRACT.md`, `graphql/schema.graphql` |
| gRPC method/message | `docs/API_CONTRACT.md`, relevant `proto/*.proto` |
| Table/index/seed | `docs/DATABASE_SCHEMA.md`, SQL files |
| Event/topic | `docs/API_CONTRACT.md`, `docs/ARCHITECTURE.md` |
| Service boundary | `docs/ARCHITECTURE.md` |
| Setup/env/ports | `docs/README_SETUP.md`, `.env.example` |
| Teacher spec alignment | `README.md`, relevant `docs/agent-context/*`, and source-of-truth docs |

## 13. Definition of Done

A task is done when:

1. Assigned requirement is completed.
2. Change stays inside MVP scope.
3. Relevant verification is done or blocker is documented.
4. Contracts/docs are updated if behavior changed.
5. No secrets or real data are committed.
6. Assignment sheet status/note is updated.
7. PR is ready for review or task is clearly blocked.

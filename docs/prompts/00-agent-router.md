# Agent Prompt Router - Intercity Bus Booking AI

Use this file as the parent prompt for AI Agents working on this repository.

Prompt role files are workflow guides only. They do not replace the source-of-truth docs:

- `AGENTS.md`
- `docs/agent-context/00-index.md`
- `docs/DEV_WORKFLOW.md`
- `docs/CODING_GUIDELINES.md`
- `docs/API_CONTRACT.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/README_SETUP.md`
- `docs/ARCHITECTURE.md`

## Required First Steps

Before proposing or coding, the Agent must:

1. Inspect the local repository state:

```bash
git status --short --branch
git branch --show-current
git log --oneline --max-count=5
```

2. Read common rules:

```text
docs/prompts/01-common-rules.md
```

3. Read required project docs:

```text
AGENTS.md
docs/agent-context/00-index.md
docs/DEV_WORKFLOW.md
docs/CODING_GUIDELINES.md
```

4. Read the assignment row from the team assignment sheet when provided.

## Route By Work Type

Choose exactly one primary role prompt:

| Work type | Prompt |
|---|---|
| New feature or assigned module work | `docs/prompts/02-dev-feature.md` |
| Bug fix | `docs/prompts/03-bugfix.md` |
| Refactor | `docs/prompts/04-refactor.md` |
| Code review or PR review | `docs/prompts/05-code-review.md` |
| QA, UAT, local demo, verification | `docs/prompts/06-qa-demo.md` |

If the task spans multiple work types, choose the smallest primary prompt that matches the user's explicit request.

## Scope Classification

| Assignment area | Normal scope |
|---|---|
| Frontend/UI | `apps/web/` |
| GraphQL Gateway | `services/graphql-gateway/`, `graphql/schema.graphql` |
| Trip Service | `services/trip-service/`, `proto/trip.proto` |
| Seat Inventory | `services/seat-inventory-service/`, `proto/seat_inventory.proto` |
| Booking | `services/booking-service/`, `proto/booking.proto` |
| Workers | `workers/`, RabbitMQ docs |
| Analytics | `services/analytics-service/`, Kafka docs |
| AI/MCP | `services/mcp-server/`, AI tooling docs |
| Database | `database/`, `docs/DATABASE_SCHEMA.md` |
| Infra/setup | `docker-compose.yml`, `infrastructure/`, setup docs |

If inferred scope is ambiguous, overlaps another member's assignment, or requires changing contracts outside the assigned task, stop and ask before coding.

## Router Output

Before implementation, state briefly:

```text
Local branch:
Local repo state:
Assigned row:
Chosen prompt:
Inferred scope:
Required docs:
Assumptions or blockers:
```

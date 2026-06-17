# Task Template for Team Members and AI Agents

Copy this template when assigning work to a developer or AI Agent.

```text
You are working in the Intercity Bus Booking AI repository.

Read first:
- AGENTS.md
- docs/agent-context/00-index.md
- docs/DEV_WORKFLOW.md
- docs/CODING_GUIDELINES.md

Task information:
- Feature group:
- Feature/task:
- Owner:
- Status:
- Priority:
- Deadline:
- Output expected:
- Allowed files/area:
- Related docs:
- Notes:

Scope lock:
- Implement only this task.
- Do not add unrelated features, screens, services, endpoints, tables, packages, or architecture changes.
- If GraphQL changes are required, update docs/API_CONTRACT.md and graphql/schema.graphql.
- If gRPC changes are required, update docs/API_CONTRACT.md and the relevant proto file.
- If database changes are required, update docs/DATABASE_SCHEMA.md and database/schema.sql.
- If setup changes are required, update docs/README_SETUP.md and .env.example when needed.
- If behavior is unclear, list assumptions before coding.
- If you find an issue outside scope, report it instead of fixing it silently.

Acceptance criteria:
- [ ]
- [ ]
- [ ]

Verification required:
- [ ] npm run check:docs, if docs/contracts changed
- [ ] docker compose config, if infrastructure changed
- [ ] Frontend build/lint, if frontend changed and tooling exists
- [ ] Service/unit/manual API test notes, if service changed
- [ ] Database apply/seed verification notes, if database changed

Completion report format:
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

## Minimal Prompt for Small Tasks

```text
Read AGENTS.md and docs/DEV_WORKFLOW.md first.
Complete only this assigned task:

<paste assignment row>

Follow docs/API_CONTRACT.md if the task touches GraphQL, gRPC, events, MCP, or service boundaries.
Follow docs/DATABASE_SCHEMA.md if the task touches database.
Do not add features outside MVP.
Report changed files, tests, assumptions, blockers, and out-of-scope issues.
```

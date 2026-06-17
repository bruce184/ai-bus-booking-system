# Agent Context Index

## Purpose

This directory gives AI Agents and team members a compact, task-oriented view of Intercity Bus Booking AI. It prevents agents from guessing architecture, scope, service boundaries, contracts, or file placement.

## Start Here

Read in this order:

1. `AGENTS.md`
2. `docs/agent-context/00-index.md`
3. `docs/DEV_WORKFLOW.md`
4. The context file that matches the task type
5. The assignment row from the team sheet
6. `docs/prompts/00-agent-router.md` when using role-based Agent prompts

## Context Files

| File | Use When |
|---|---|
| `01-system-overview.md` | You need product goal, users, MVP scope, and boundaries |
| `02-project-structure.md` | You need to know where files belong |
| `03-architecture.md` | You need service boundaries and communication rules |
| `04-feature-scope.md` | You need allowed, optional, and out-of-scope features |
| `05-data-api-contract.md` | You touch GraphQL, gRPC, events, MCP, database, or shared shapes |
| `06-ui-design.md` | You touch frontend screens, forms, state, seat map, or responsive UI |
| `07-security-privacy.md` | You touch auth, roles, booking lookup, PII, or secrets |
| `08-agent-task-playbook.md` | You need the standard task execution checklist |
| `09-known-risks-and-backlog.md` | You find issues outside current scope |

## Prompt Pack

| File | Use When |
|---|---|
| `docs/prompts/00-agent-router.md` | Parent prompt that routes Agents by work type |
| `docs/prompts/01-common-rules.md` | Common local-state, scope, security, and CLI timeout rules |
| `docs/prompts/02-dev-feature.md` | Assigned feature or module implementation |
| `docs/prompts/03-bugfix.md` | Bug investigation and fix |
| `docs/prompts/04-refactor.md` | Behavior-preserving refactor |
| `docs/prompts/05-code-review.md` | Local branch or PR review |
| `docs/prompts/06-qa-demo.md` | QA, UAT, and local demo verification |

Prompt files define Agent workflow. They do not replace the source-of-truth docs.

## Required Source-of-Truth Files

| Area | Source of Truth |
|---|---|
| Local setup and Docker setup | `docs/README_SETUP.md` |
| Service boundaries and flows | `docs/ARCHITECTURE.md` |
| GraphQL, gRPC, events, MCP | `docs/API_CONTRACT.md` |
| Database tables, indexes, seed | `docs/DATABASE_SCHEMA.md` |
| Coding, branch, commit, PR rules | `docs/CODING_GUIDELINES.md` |
| Team/Agent workflow | `docs/DEV_WORKFLOW.md` |

## Core Rule

If a task conflicts with the source-of-truth docs, stop and report the conflict. Do not invent a new behavior.

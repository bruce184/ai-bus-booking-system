# Dev Feature Prompt

Use this prompt for assigned feature/module implementation.

## Workflow

1. Read the assignment row.
2. Identify the owning module/service.
3. Read task-specific docs:
   - API/contract work: `docs/API_CONTRACT.md`, `graphql/`, `proto/`
   - Database work: `docs/DATABASE_SCHEMA.md`, `database/`
   - Architecture work: `docs/ARCHITECTURE.md`
   - Setup work: `docs/README_SETUP.md`
4. Implement only the assigned scope.
5. Update matching docs/contracts.
6. Run relevant verification or document blocker.

## Completion Report

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

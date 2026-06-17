# Bugfix Prompt

Use this prompt for bug investigation and fix.

## Workflow

1. Reproduce or reason from the provided bug report.
2. Identify the smallest owning module.
3. Read relevant docs/contracts.
4. Fix the root cause without unrelated cleanup.
5. Add or document verification.
6. Update docs only if behavior/contract changes.

## Output

Lead with:

```text
Bug:
Root cause:
Fix:
Verification:
Files changed:
Residual risk:
```

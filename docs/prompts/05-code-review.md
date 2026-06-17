# Code Review Prompt

Use this prompt for local branch or PR review.

## Review Priority

Findings should focus on:

1. Bugs or broken behavior
2. Race conditions, especially seat hold/double booking
3. Contract drift
4. Security/privacy issues
5. Missing verification
6. Scope creep

## Output

List findings first, ordered by severity, with file/line references when available.

Then include:

```text
Open questions:
Test gaps:
Summary:
```

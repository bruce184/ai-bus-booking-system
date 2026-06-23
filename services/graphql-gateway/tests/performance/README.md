# GraphQL Gateway Performance Tests

This folder contains the Apache JMeter benchmark plan for the GraphQL Gateway.

## Prerequisites

Install Apache JMeter and make sure the `jmeter` command is available on `PATH`.

## Run

Start the gateway and dependent demo services first:

```bash
npm --prefix services/graphql-gateway start
```

Run the benchmark:

```bash
npm --prefix services/graphql-gateway run test:perf
```

The script removes old local JMeter output before each run, then writes:

```text
tests/performance/results.jtl
tests/performance/report/
```

These generated outputs are ignored by Git.

## Scenario

The JMeter plan runs 50 concurrent threads, ramps them up over 5 seconds, and keeps the test active for 10 seconds. Each thread repeatedly sends a public GraphQL `seatMap` query to `http://localhost:4000/graphql`.

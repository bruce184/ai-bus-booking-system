# GraphQL Gateway

Owns public GraphQL schema, demo auth context, orchestration, and subscriptions.

Current status:

```text
B-1 scaffold exists. The gateway can start, load the shared GraphQL schema, and prepare gRPC clients from the proto contracts.
B-2 demo auth exists. The gateway supports login, me, JWT signing/verification, and reusable role helpers.
Admin baseline resolvers exist for local demo authentication, operations wiring, analytics smoke data, API tests, integration tests, and performance benchmarks.
Remaining business resolvers still depend on the assigned backend services.
```

## Local Commands

Install dependencies from this folder before running service scripts:

```bash
npm install
```

Run in watch mode:

```bash
npm run dev
```

From the repository root:

```bash
npm run dev:gateway
npm run typecheck:gateway
npm run build:gateway
```

Run API and performance tests from this package:

```bash
npm run test
npm run test:integration
npm run test:api
npm run test:perf
```

`test:integration` starts a real GraphQL Gateway process on port `4100` and checks HTTP GraphQL auth, admin authorization, analytics, and unavailable gRPC dependency error mapping.

`test:perf` requires Apache JMeter on `PATH` and writes ignored local output under `tests/performance/`.

Default endpoint:

```text
http://localhost:4000/graphql
```

## Demo Auth

Local demo credentials:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `admin123` |
| Staff | `staff@example.com` | `staff123` |
| Customer | `customer@example.com` | `customer123` |

Login mutation:

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    token
    expiresAt
    user {
      id
      email
      role
    }
  }
}
```

Use the returned token as:

```text
Authorization: Bearer <token>
```

Then `me` returns the current user.

Must expose:

- Public/customer search, seat, checkout, booking, and saved-passenger operations
- Admin route/stop/vehicle/trip/booking/check-in/analytics/event-log operations
- Seat and booking subscriptions
- AI chatbot tool endpoints when the AI task is assigned

Source contract:

```text
graphql/schema.graphql
docs/API_CONTRACT.md
```

Internal service calls should use gRPC.

The B-1 scaffold creates gRPC client stubs for:

```text
TripService              -> proto/trip.proto
BookingService           -> proto/booking.proto
SeatInventoryService     -> proto/seat_inventory.proto
```

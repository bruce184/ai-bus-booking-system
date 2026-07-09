# MCP Server

Exposes external AI tools/resources.

Tools:

```text
search_trips
get_trip_detail
get_booking_status
get_revenue_summary
get_popular_routes
```

Resources:

```text
bus://policy/cancellation
bus://policy/checkin
bus://routes/popular
bus://system/health
```

Booking status lookup must require booking code and email.

MCP tools must call internal service/tool boundaries and must not fabricate trip inventory, booking status, seat state, or revenue.

Admin revenue tools are demo/admin-only and require `MCP_ADMIN_TOKEN`.

Current Module 5 scaffold:

- Runs an MCP JSON-RPC HTTP endpoint at `http://localhost:4010/mcp`.
- Supports `initialize`, `tools/list`, `tools/call`, `resources/list`, and `resources/read`.
- `get_booking_status` validates both booking code and email before calling GraphQL.
- `get_revenue_summary` requires `MCP_ADMIN_TOKEN` and reads aggregate analytics from the Analytics Service.

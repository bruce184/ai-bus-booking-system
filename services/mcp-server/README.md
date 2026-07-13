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

Admin revenue tools are demo/admin-only. Configure `MCP_ADMIN_TOKEN`, then
send that value as the MCP HTTP `Authorization: Bearer ...` credential; the
secret is not part of the tool arguments exposed to the model.

Current Module 5 implementation:

- Uses the official MCP TypeScript SDK v1 Streamable HTTP transport at
  `http://127.0.0.1:4010/mcp` (stateless JSON response mode).
- Supports SDK-negotiated initialization, tools, resources, notifications,
  protocol headers, content negotiation, and JSON-RPC validation.
- Uses the SDK's localhost host-header validation to prevent DNS rebinding.
- `get_booking_status` validates both booking code and email before calling GraphQL.
- `get_revenue_summary` requires the configured bearer token and reads aggregate analytics from the Analytics Service.

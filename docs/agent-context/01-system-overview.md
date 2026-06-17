# System Overview

## Product Goal

Build a local-demo-ready intercity bus booking system with AI support and an MCP Server.

Users can:

- Search trips by origin, destination, and departure date.
- Filter, sort, and see nearby-date suggestions.
- View trip detail and seat map.
- Hold seats temporarily.
- Checkout as guest or registered customer.
- Simulate payment.
- Receive an HTML/PDF-ready e-ticket.
- Lookup booking status with booking code and email.
- Save passenger profiles when registered.

Admins/staff can:

- Log in through local demo auth.
- Manage routes, stops, vehicles, seat layouts, trips, seats, bookings, and check-in.
- Activate, lock, depart, complete, or cancel trips.
- View revenue, booking, route, popular-search, conversion, and event-log dashboards.

AI clients can:

- Use chatbot tools inside the web app.
- Use MCP tools/resources from external AI clients.

## MVP Modules

```text
Trip Search and Catalog
Seat Inventory and Real-time Seat Hold
Booking, Payment Simulation, Ticket, Notification
Admin Operations
Analytics, AI Chatbot, MCP Server
```

## Hard Requirements

```text
GraphQL
gRPC
Microservices
RabbitMQ/Kafka
Redis
Nginx
Next.js
AI SDK
MCP Server
```

## Product Boundary

Local demo first. Do not implement real payment, real email/SMS delivery, or production auth beyond the assigned task without approval.

## Baseline Status

This repo currently contains docs, contracts, schema/proto files, and infrastructure only. Service and UI implementation files should be added later inside assigned modules.

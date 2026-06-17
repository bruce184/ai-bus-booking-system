# System Overview

## Product Goal

Build a local-demo-ready intercity bus booking system with AI support and an MCP Server.

Users can:

- Search trips by origin, destination, and departure date.
- Filter and sort trips.
- View trip detail and seat map.
- Hold seats temporarily.
- Checkout as guest or registered customer.
- Simulate payment.
- Receive an e-ticket.
- Lookup booking status with booking code and email.

Admins/staff can:

- Manage routes, stops, vehicles, trips, seats, bookings, and check-in.
- View revenue and analytics dashboards.

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

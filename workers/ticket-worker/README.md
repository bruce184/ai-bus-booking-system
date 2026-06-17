# Ticket Worker

Consumes booking workflow events and generates e-ticket records.

Primary event:

```text
booking.paid
```

Expected output:

- Ticket code
- QR payload string
- Check-in policy snapshot
- Simple HTML ticket content
- Optional PDF URL/content handoff if assigned
- Ticket status/event log

Ticket content must include booking code, ticket code, passenger, route, pickup point, dropoff point, departure time, seat, vehicle code or plate, QR payload, and check-in policy.

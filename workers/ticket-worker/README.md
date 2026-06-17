# Ticket Worker

Consumes booking workflow events and generates e-ticket records.

Primary event:

```text
booking.paid
```

Expected output:

- Ticket code
- QR payload string
- Ticket status/event log

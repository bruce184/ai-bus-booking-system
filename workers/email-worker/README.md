# Email Worker

Consumes ticket/notification events and logs simulated email delivery.

Primary events:

```text
booking.paid
ticket.issued
email.requested
```

MVP must not require real SMTP delivery.

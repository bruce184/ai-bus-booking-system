# Email Worker

Consumes ticket/notification events and logs simulated email delivery.

Primary events:

```text
booking.paid
ticket.issued
email.requested
```

MVP must not require real SMTP delivery.

The demo worker should log enough email content to prove the customer would receive booking/ticket details. Do not add real SMTP credentials unless a later task explicitly changes scope.

Each canonical workflow `eventId` is claimed under
`email-worker.notifications` before the simulated delivery log. RabbitMQ
redelivery therefore skips an event already handled by this consumer.

Unit verification:

```bash
npm run test:email-worker
```

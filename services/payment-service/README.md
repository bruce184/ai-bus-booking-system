# Payment Service

Owns simulated payment boundary.

MVP supports:

- Simulated success
- Simulated failure
- Payment analytics event

The HTTP payment result does not wait for Kafka. Analytics publishing is
best-effort and logs failures, so a Kafka outage cannot change a successfully
decided simulation into an HTTP 500 response.

Unit verification:

```bash
npm run test:payment
```

Do not add real payment gateway credentials in MVP.

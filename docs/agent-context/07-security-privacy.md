# Security and Privacy Context

## Secrets

Never commit:

- `.env`
- AI provider keys
- Database passwords
- JWT secrets
- SMTP credentials
- Real customer data
- Real passenger phone/email/ID data

## Booking Privacy

Public booking lookup must require:

```text
bookingCode
email
```

Chatbot and MCP tools must refuse private booking details when either is missing.

## Roles

```text
ADMIN
STAFF
CUSTOMER
```

Admin revenue and operations tools should be protected when auth is implemented.

Admin login is required for the MVP demo, but production-grade auth is out of scope unless assigned. Demo auth may use seeded accounts and local JWT/session placeholders.

## Demo Data

Use fake names, fake phone numbers, fake emails, and fake booking codes only.

Saved passenger profiles and ticket content are also personal data. Keep all examples fake.

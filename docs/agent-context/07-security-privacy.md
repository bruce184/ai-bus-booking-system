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

## Demo Data

Use fake names, fake phone numbers, fake emails, and fake booking codes only.

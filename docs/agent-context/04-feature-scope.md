# Feature Scope

## Required MVP

- Trip search by origin, destination, date
- Autocomplete locations/stations
- Trip filters and sorting
- Empty search nearby-date suggestions
- SEO metadata for popular route pages
- Trip detail and seat map
- Seat hold with Redis TTL
- Real-time-ish seat updates via GraphQL Subscription
- Guest and registered checkout
- Registered customer saved passenger profiles
- Simulated payment success/failure
- E-ticket generation with ticket code, QR payload, policy snapshot, and HTML/PDF-ready content
- Simulated email/log notification
- Booking lookup by booking code and email
- Admin CRUD for route/stop/vehicle/trip
- Admin vehicle seat layout configuration
- Admin trip activate/lock/depart/complete/cancel state changes
- Admin seat blocking
- Admin booking list, event logs, and check-in by booking/ticket/QR payload
- Revenue, booking, tickets-by-route, popular-route, and conversion dashboards
- Kafka analytics events
- Chatbot AI with internal tools
- MCP Server tools/resources

## Could-Have

- Better admin charts
- QR image generation instead of text QR payload
- Persisted PDF file storage beyond the optional contract URL
- Dark mode
- More realistic auth/permissions

## Out of Scope Unless Approved

- Real payment gateway
- Real email/SMS sending
- Native mobile app
- Production QR scanner integration
- Multi-company billing
- Complex promotion/coupon engine
- Production observability stack

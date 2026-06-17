# Feature Scope

## Required MVP

- Trip search by origin, destination, date
- Autocomplete locations/stations
- Trip filters and sorting
- Trip detail and seat map
- Seat hold with Redis TTL
- Real-time-ish seat updates via GraphQL Subscription
- Guest and registered checkout
- Simulated payment success/failure
- E-ticket generation
- Simulated email/log notification
- Booking lookup by booking code and email
- Admin CRUD for route/stop/vehicle/trip
- Admin booking list and check-in
- Revenue and booking dashboard
- Kafka analytics events
- Chatbot AI with internal tools
- MCP Server tools/resources

## Could-Have

- Better admin charts
- QR image generation instead of text QR payload
- PDF ticket export
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

# Web App

Next.js frontend lives here.

Expected responsibilities:

- Public trip search
- Autocomplete
- Search results and filters
- Nearby-date suggestions when no trips match
- SEO route pages for popular routes
- Trip detail and seat map
- Seat hold countdown
- Checkout and payment simulation
- Booking confirmation and lookup
- Customer booking history
- Saved passenger profiles
- Admin dashboard and operations
- Admin route/stop/vehicle/seat-layout/trip CRUD
- Admin trip status, seat block, event log, and check-in workflows
- Chatbot panel

Web must call GraphQL Gateway, not internal gRPC services directly.

Current Module 5 scaffold:

- Next.js app scaffold with a chatbot panel on the search/booking landing page.
- Chatbot actions call `searchTrips` and `getBookingStatus` tool functions through the GraphQL Gateway.
- Booking lookup refuses to run without both booking code and email.
- Cancellation/check-in answers come from internal policy resource text and include a source label.

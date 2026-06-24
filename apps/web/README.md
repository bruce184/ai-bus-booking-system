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

Run admin E2E tests from the repository root with:

```bash
npm run test:web:e2e
```

## Seat Map Component

Task `Q-10` adds a reusable React seat map component:

```text
src/components/SeatMap.jsx
```

It supports:

- Four seat states: `AVAILABLE`, `HELD`, `BOOKED`, `BLOCKED`
- Multi-seat selection for available seats
- GraphQL `holdSeats` mutation through `src/graphql/seatOperations.js`
- Loading, disabled, and error states for the hold action
- Countdown display from `hold.expiresAt`
- Automatic `releaseSeatHold` mutation when the hold expires

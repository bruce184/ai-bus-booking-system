# Trip Service

gRPC service that owns the trip catalog and search. Implemented against
`proto/trip.proto` (package `bus.trip.v1`).

## Owns

- Locations, Routes, Stops, Vehicles, Vehicle seat layouts, Trips
- Trip search, search cache metadata, SEO metadata for popular route pages
- Nearby-date suggestions for empty search results
- Popular routes source data
- Admin CRUD for route, stop, vehicle, seat layout, and trip records
- Trip status changes: DRAFT, ACTIVE, LOCKED, DEPARTED, COMPLETED, CANCELLED

## RPCs

| Group | RPCs |
|---|---|
| Search / catalog | `AutocompleteLocations`, `SearchTrips`, `GetTripDetail`, `ListPopularRoutes` |
| Route admin | `CreateRoute`, `UpdateRoute`, `DeleteRoute` |
| Stop admin | `CreateStop`, `UpdateStop`, `DeleteStop` |
| Vehicle admin | `CreateVehicle`, `UpdateVehicle`, `DeleteVehicle`, `ConfigureVehicleSeats` |
| Trip admin | `CreateTrip`, `UpdateTrip`, `DeleteTrip`, `UpdateTripStatus` |

## Dependencies

| Dependency | Required? | Used for |
|---|---|---|
| PostgreSQL | **Yes** | Source of truth for all trip-domain data |
| Redis | Optional | Search-result cache + popular-route counters (degrades gracefully) |
| Kafka | Optional | Publishes `trip.search_performed` to `search-events` (degrades gracefully) |

If Redis or Kafka are down the service still serves search from PostgreSQL.

## Source layout

```text
src/
  index.js              # entrypoint: init deps, start gRPC server, graceful shutdown
  server.js             # loads proto/trip.proto, binds every RPC to a handler
  config.js             # env config (reads repo-root .env then service .env)
  db.js                 # PostgreSQL pool
  cache.js              # Redis search cache + popular routes (optional)
  events.js             # Kafka producer for trip.search_performed (optional)
  mappers.js            # SQL row -> proto message mapping
  tripQuery.js          # shared trip SELECT + row->Trip builder
  policies.js           # static demo cancellation/check-in policy text
  errors.js             # domain errors -> gRPC status codes
  service/
    searchCatalog.js    # AutocompleteLocations, SearchTrips, GetTripDetail, ListPopularRoutes
    adminCatalog.js     # route/stop/vehicle/trip CRUD + ConfigureVehicleSeats + UpdateTripStatus
scripts/
  test-client.js        # standalone gRPC client to verify the service end-to-end
```

## Run locally

From the repo root, start infrastructure (Postgres applies `database/schema.sql`
and `database/seed.sql` automatically on first boot):

```bash
docker compose up -d postgres redis kafka zookeeper
```

Then from this folder:

```bash
cp .env.example .env        # optional; root .env is also read
npm install
npm start                   # gRPC server on :50051
```

## Verify

With the service running and Postgres seeded:

```bash
npm run test:client
# or with explicit args:
node scripts/test-client.js "TP.HCM" "Da Lat" 2026-07-01
```

Expected: autocomplete returns locations, `SearchTrips` returns the demo
TP.HCM→Da Lat trips with an SEO title, `GetTripDetail` returns pickup/dropoff
points + seat layout + policies, and `ListPopularRoutes` lists routes.

## Contract & integration

- Contract source of truth: `proto/trip.proto`, `docs/API_CONTRACT.md`
- Gateway wiring: see [`INTEGRATION.md`](INTEGRATION.md)

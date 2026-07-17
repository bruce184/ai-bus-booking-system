# Trip Service

gRPC service that owns the trip catalog and search. Implemented against
`proto/trip.proto` (package `bus.trip.v1`).

## Owns

- Locations, Routes, Stops, Vehicles, Vehicle seat layouts, Trips
- Trip search with short-lived catalog caching and live seat-availability
  revalidation, plus SEO metadata for popular route pages
- Nearby-date suggestions for empty search results
- Public popular-route ranking from the read-only analytics aggregate
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
| PostgreSQL | **Yes** | Trip-domain source of truth plus read-only `analytics_daily.search_count` projection |
| Redis | Optional | Search-result cache (degrades gracefully) |
| Kafka | Optional | Publishes `trip.search_performed` to `search-events` (degrades gracefully) |

If Redis or Kafka are down the service still serves search from PostgreSQL.
Analytics Service remains the sole writer of `analytics_daily`; Trip Service
only reads the popular-route projection.

## Source layout

```text
src/
  index.js              # entrypoint: init deps, start gRPC server, graceful shutdown
  server.js             # loads proto/trip.proto, binds every RPC to a handler
  config.js             # env config (reads repo-root .env then service .env)
  db.js                 # PostgreSQL pool
  cache.js              # Redis search-result cache (optional)
  events.js             # Kafka producer for trip.search_performed (optional)
  mappers.js            # SQL row -> proto message mapping
  searchRules.js        # deterministic sort and popular-route mapping rules
  tripQuery.js          # shared trip SELECT + row->Trip builder
  policies.js           # static demo cancellation/check-in policy text
  errors.js             # domain errors -> gRPC status codes
  service/
    searchCatalog.js    # AutocompleteLocations, SearchTrips, GetTripDetail, ListPopularRoutes
    adminCatalog.js     # route/stop/vehicle/trip CRUD + ConfigureVehicleSeats + UpdateTripStatus
scripts/
  test-client.js        # standalone gRPC client to verify the service end-to-end
tests/
  searchRules.test.js   # unit coverage for public search/catalog rules
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

Unit rules:

```bash
npm test
```

Expected integration result: autocomplete returns locations, `SearchTrips`
returns the demo TP.HCM→Da Lat trips with an SEO title, `GetTripDetail` returns
pickup/dropoff points + policies, and `ListPopularRoutes` lists routes from
analytics search counts. The live seat map comes only from Seat Inventory
Service through the GraphQL Gateway.

## Contract & integration

- Contract source of truth: `proto/trip.proto`, `docs/API_CONTRACT.md`
- Gateway wiring: see [`INTEGRATION.md`](INTEGRATION.md)

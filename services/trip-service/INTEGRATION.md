# Trip Service — Gateway Integration Guide

This is the hand-off spec for whoever owns the **GraphQL Gateway**
(`hoang/gateway-admin-baseline`). The Trip Service is a gRPC service; the
gateway is its only public caller. Nothing here needs to change in the
Trip Service — just wire the resolvers below to the gRPC client.

> Boundary note: this file documents the trip-domain slice of the gateway.
> It is NOT committed into `services/graphql-gateway/`. Copy the snippets into
> the gateway module so there is no cross-branch file conflict.

## 1. Connection

| Item | Value |
|---|---|
| Proto | `proto/trip.proto` (package `bus.trip.v1`, service `TripService`) |
| Address | `localhost:${TRIP_SERVICE_PORT}` (default `50051`) |
| Credentials | insecure (local demo) |
| Env | `TRIP_SERVICE_PORT=50051` |

## 2. gRPC client (gateway side)

Load the proto with `keepCase:false` so gRPC responses come back in **camelCase**
and map almost 1:1 onto the GraphQL types. `enums:String` makes `TripStatus`
come back as `"ACTIVE"` etc., matching the GraphQL enum.

```js
// services/graphql-gateway/src/clients/tripClient.js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const here = path.dirname(fileURLToPath(import.meta.url));
const protoPath = path.resolve(here, '../../../../proto/trip.proto'); // adjust to your layout

const def = protoLoader.loadSync(protoPath, {
  keepCase: false, // camelCase fields -> aligns with GraphQL
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(def);

const client = new proto.bus.trip.v1.TripService(
  process.env.TRIP_SERVICE_TARGET || `localhost:${process.env.TRIP_SERVICE_PORT || 50051}`,
  grpc.credentials.createInsecure(),
);

// promisified call helper
export const tripRpc = (method, req) => promisify(client[method].bind(client))(req);
```

## 3. Resolver mapping (GraphQL → gRPC)

Because the client uses camelCase, request/response field names line up with the
GraphQL schema. The resolvers are thin pass-throughs.

```js
// services/graphql-gateway/src/resolvers/trip.js
import { tripRpc } from '../clients/tripClient.js';

export const tripResolvers = {
  Query: {
    autocompleteLocations: (_p, { keyword }) =>
      tripRpc('AutocompleteLocations', { keyword }).then((r) => r.locations),

    // SearchTripsInput is already camelCase and matches the proto request fields.
    searchTrips: (_p, { input }) => tripRpc('SearchTrips', input),

    // GraphQL `trip(id)` -> gRPC GetTripDetail(trip_id). Returns TripDetail.
    trip: (_p, { id }) => tripRpc('GetTripDetail', { tripId: id }),

    popularRoutes: (_p, { limit }) =>
      tripRpc('ListPopularRoutes', { limit }).then((r) => r.routes),
  },

  Mutation: {
    adminCreateRoute: (_p, { input }) =>
      tripRpc('CreateRoute', input).then((r) => r.route),
    adminUpdateRoute: (_p, { id, input }) =>
      tripRpc('UpdateRoute', { id, ...input }).then((r) => r.route),
    adminDeleteRoute: (_p, { id }) =>
      tripRpc('DeleteRoute', { id }).then((r) => r.deleted),

    adminCreateStop: (_p, { input }) =>
      tripRpc('CreateStop', input).then((r) => r.stop),
    adminUpdateStop: (_p, { id, input }) =>
      tripRpc('UpdateStop', { id, ...input }).then((r) => r.stop),
    adminDeleteStop: (_p, { id }) =>
      tripRpc('DeleteStop', { id }).then((r) => r.deleted),

    adminCreateVehicle: (_p, { input }) =>
      tripRpc('CreateVehicle', input).then((r) => r.vehicle),
    adminUpdateVehicle: (_p, { id, input }) =>
      tripRpc('UpdateVehicle', { id, ...input }).then((r) => r.vehicle),
    adminDeleteVehicle: (_p, { id }) =>
      tripRpc('DeleteVehicle', { id }).then((r) => r.deleted),
    adminConfigureVehicleSeats: (_p, { vehicleId, seats }) =>
      tripRpc('ConfigureVehicleSeats', { vehicleId, seats }).then((r) => r.seats),

    adminCreateTrip: (_p, { input }) =>
      tripRpc('CreateTrip', input).then((r) => r.trip),
    adminUpdateTrip: (_p, { id, input }) =>
      tripRpc('UpdateTrip', { id, ...input }).then((r) => r.trip),
    adminDeleteTrip: (_p, { id }) =>
      tripRpc('DeleteTrip', { id }).then((r) => r.deleted),
    adminUpdateTripStatus: (_p, { input }) =>
      tripRpc('UpdateTripStatus', input).then((r) => r.trip),
  },
};
```

## 4. Field/contract notes

- **`Trip.vehicle` / `Trip.route`** are populated on every result. In search
  results `vehicle.seats` is empty (layout omitted for performance).
- **`GetTripDetail` does not return seats.** The seat map — layout plus live
  status merged with Redis holds — is owned by **Seat Inventory Service** via
  `seatMap(tripId)`. The gateway already resolves `TripDetail.seats` there, so
  nothing changes on the GraphQL side.
- **DateTime**: `departureTime`/`arrivalTime` are ISO-8601 strings. The gateway's
  `DateTime` scalar should accept/serialize ISO strings.
- **Errors**: the service returns gRPC `NOT_FOUND` / `INVALID_ARGUMENT` /
  `INTERNAL`. Translate to the API_CONTRACT codes: `NOT_FOUND`,
  `VALIDATION_ERROR`, `INTERNAL_ERROR`.
- **`TripSearchResult`** maps directly: `{ trips, suggestedDates, seoTitle, cacheHit }`.

## 5. Not owned by Trip Service

These gateway operations route to other services — do **not** wire them to the
trip client: `seatMap`, `holdSeats`, `releaseSeatHold` (Seat Inventory);
`createBooking`, `simulatePayment`, `bookingStatus`, `myBookings`,
`adminBookings`, `adminCheckIn`, saved-passenger ops (Booking);
`adminRevenueSummary`, `adminAnalyticsDashboard`, `adminEventLogs` (Analytics).

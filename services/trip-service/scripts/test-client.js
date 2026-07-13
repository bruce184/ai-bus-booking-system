// Standalone gRPC client to verify the Trip Service without the GraphQL Gateway.
//
// Usage:
//   node scripts/test-client.js                       # uses demo defaults
//   node scripts/test-client.js "TP.HCM" "Da Lat" 2026-07-01
//
// Requires the Trip Service running (npm start) and Postgres seeded.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { businessDate } from '@bus/shared/date.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const protoPath = path.resolve(here, '..', '..', '..', 'proto', 'trip.proto');
const target = process.env.TRIP_SERVICE_TARGET || 'localhost:50051';

const [origin = 'TP.HCM', destination = 'Da Lat', date = defaultDate()] = process.argv.slice(2);

function defaultDate() {
  return businessDate(new Date(), 2);
}

function buildClient() {
  const def = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(def);
  return new proto.bus.trip.v1.TripService(target, grpc.credentials.createInsecure());
}

async function main() {
  const client = buildClient();
  const call = (name, req) => promisify(client[name].bind(client))(req);

  console.log(`\n== AutocompleteLocations(keyword="TP") ==`);
  const ac = await call('AutocompleteLocations', { keyword: 'TP' });
  console.log(ac.locations.map((l) => `${l.name} [${l.type}]`).join(', ') || '(none)');

  console.log(`\n== SearchTrips(${origin} -> ${destination} @ ${date}) ==`);
  const search = await call('SearchTrips', { origin, destination, departure_date: date, sort_by: 'price-desc' });
  console.log(`seo_title: ${search.seo_title}`);
  console.log(`cache_hit: ${search.cache_hit}, trips: ${search.trips.length}, suggested_dates: ${JSON.stringify(search.suggested_dates)}`);
  for (const t of search.trips) {
    console.log(`  - ${t.id} | ${t.operator_name} ${t.vehicle_type} | ${t.departure_time} -> ${t.arrival_time} | ${t.price}d | seats:${t.available_seats} | ${t.status}`);
  }
  for (let index = 1; index < search.trips.length; index += 1) {
    if (search.trips[index - 1].price < search.trips[index].price) {
      throw new Error('SearchTrips price-desc ordering invariant failed');
    }
  }

  if (search.trips.length > 0) {
    const tripId = search.trips[0].id;
    console.log(`\n== GetTripDetail(${tripId}) ==`);
    const detail = await call('GetTripDetail', { trip_id: tripId });
    console.log(`route: ${detail.trip.route.origin.name} -> ${detail.trip.route.destination.name}`);
    console.log(`pickup: ${detail.pickup_points.map((s) => s.name).join(', ') || '(none)'}`);
    console.log(`dropoff: ${detail.dropoff_points.map((s) => s.name).join(', ') || '(none)'}`);
    console.log(`cancellation_policy: ${detail.cancellation_policy.slice(0, 40)}...`);
    if (Object.hasOwn(detail, 'seats')) {
      throw new Error('GetTripDetail must not return seat state owned by Seat Inventory Service');
    }
  }

  console.log(`\n== ListPopularRoutes(limit=5) ==`);
  const popular = await call('ListPopularRoutes', { limit: 5 });
  if (!popular.routes.length) {
    throw new Error('ListPopularRoutes returned no analytics search-count projections');
  }
  for (const r of popular.routes) {
    if (!r.origin || !r.destination || r.search_count <= 0) {
      throw new Error(`Invalid popular-route projection: ${JSON.stringify(r)}`);
    }
    console.log(`  - ${r.origin} -> ${r.destination} (${r.search_count})`);
  }

  console.log('\nOK: Trip Service responded to all calls.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test client error:', err.message);
  process.exit(1);
});

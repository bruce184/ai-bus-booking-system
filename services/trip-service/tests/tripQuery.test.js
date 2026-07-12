import assert from 'node:assert/strict';
import test from 'node:test';

import { rowsToTrips } from '../src/tripQuery.js';

const tripRow = {
  id: 'trip-1',
  route_id: 'route-1',
  origin_id: 'origin-1',
  origin_name: 'TP.HCM',
  origin_type: 'CITY',
  origin_address: '',
  destination_id: 'destination-1',
  destination_name: 'Da Lat',
  destination_type: 'CITY',
  destination_address: '',
  distance_km: 300,
  vehicle_id: 'vehicle-1',
  operator_name: 'Demo Operator',
  vehicle_code: 'BUS-01',
  license_plate: '00A-000.00',
  vehicle_type: 'SLEEPER',
  seat_count: 34,
  departure_time: '2026-07-12T01:00:00.000Z',
  arrival_time: '2026-07-12T07:00:00.000Z',
  price: 280000,
  status: 'ACTIVE',
  available_seats: 30
};

test('maps trip rows without leaking Array.map indexes into route stops', async () => {
  const trips = await rowsToTrips([tripRow, { ...tripRow, id: 'trip-2' }]);

  assert.equal(trips.length, 2);
  assert.deepEqual(trips[0].route.stops, []);
  assert.deepEqual(trips[1].route.stops, []);
});

test('available_seats falls back to the DB count when the hold cache is not configured', async () => {
  const [trip] = await rowsToTrips([tripRow]);
  assert.equal(trip.available_seats, tripRow.available_seats);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterByMinimumAvailability,
  refreshCachedTrips,
} from '../src/service/searchCatalog.js';

test('rehydrates cached availability and removes trips that are no longer active', async () => {
  const queries = [];
  const trips = await refreshCachedTrips(
    [
      { id: '11111111-1111-1111-1111-111111111111', status: 'ACTIVE', available_seats: 20 },
      { id: '22222222-2222-2222-2222-222222222222', status: 'ACTIVE', available_seats: 10 },
    ],
    {
      runQuery: async (sql, params) => {
        queries.push({ sql, params });
        return {
          rows: [
            { id: '11111111-1111-1111-1111-111111111111', status: 'ACTIVE', available_seats: 7 },
            { id: '22222222-2222-2222-2222-222222222222', status: 'CANCELLED', available_seats: 10 },
          ],
        };
      },
      readAvailableSeats: async (row) => row.available_seats - 2,
    },
  );

  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].params, [[
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
  ]]);
  assert.deepEqual(trips, [{
    id: '11111111-1111-1111-1111-111111111111',
    status: 'ACTIVE',
    available_seats: 5,
  }]);
});

test('applies the minimum-seat filter after live availability is refreshed', () => {
  const trips = [
    { id: 'trip-1', available_seats: 1 },
    { id: 'trip-2', available_seats: 3 },
  ];

  assert.deepEqual(filterByMinimumAvailability(trips, 2), [trips[1]]);
  assert.equal(filterByMinimumAvailability(trips, 0), trips);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { mapPopularRoute, resolveSortBy } from '../src/searchRules.js';

test('normalizes GraphQL hyphenated sort values and keeps deterministic ties', () => {
  assert.equal(resolveSortBy('price-asc'), 't.price asc, t.id asc');
  assert.equal(resolveSortBy('price-desc'), 't.price desc, t.id asc');
  assert.equal(resolveSortBy('shortest-duration'), '(t.arrival_time - t.departure_time) asc, t.id asc');
});

test('falls back to earliest departure for unknown sort values', () => {
  assert.equal(resolveSortBy('unsupported'), 't.departure_time asc, t.id asc');
  assert.equal(resolveSortBy(''), 't.departure_time asc, t.id asc');
});

test('maps the analytics route projection to the public gRPC shape', () => {
  assert.deepEqual(mapPopularRoute({
    route_label: 'TP.HCM -> Da Lat',
    total_searches: '97',
  }), {
    origin: 'TP.HCM',
    destination: 'Da Lat',
    search_count: 97,
  });
});

test('drops malformed aggregate route labels', () => {
  assert.equal(mapPopularRoute({ route_label: 'Unknown Route', total_searches: 10 }), null);
  assert.equal(mapPopularRoute({ route_label: 'TP.HCM -> ', total_searches: 10 }), null);
});

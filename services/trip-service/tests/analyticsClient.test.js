import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchPopularRoutes } from '../src/analytics-client.js';

test('fetchPopularRoutes requests the configured limit and returns the parsed array', async (t) => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => [{ origin: 'TP.HCM', destination: 'Da Lat', searchCount: 97 }],
    };
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const routes = await fetchPopularRoutes(5);

  assert.equal(new URL(requestedUrl).pathname, '/popular-routes');
  assert.equal(new URL(requestedUrl).searchParams.get('limit'), '5');
  assert.deepEqual(routes, [{ origin: 'TP.HCM', destination: 'Da Lat', searchCount: 97 }]);
});

test('fetchPopularRoutes degrades to an empty list when Analytics Service is unreachable', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('connection refused');
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  assert.deepEqual(await fetchPopularRoutes(5), []);
});

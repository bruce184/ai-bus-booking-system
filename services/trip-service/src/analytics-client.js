// Analytics Service is the sole writer/owner of analytics_daily
// (database-per-service - docs/ARCHITECTURE.md section 11). ListPopularRoutes
// reads its existing GET /popular-routes projection over HTTP instead of
// querying that table directly, same transport gateway/analytics/client.js
// already uses for the admin dashboard.
import { fetchWithTimeout } from '@bus/shared/http.js';
import { CORRELATION_METADATA_KEY, getCorrelationId } from '@bus/shared/correlation.js';

import { config } from './config.js';
import { logger } from './logger.js';

export async function fetchPopularRoutes(limit) {
  const url = new URL('/popular-routes', config.analyticsBaseUrl);
  url.searchParams.set('limit', String(limit));

  const correlationId = getCorrelationId();
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        accept: 'application/json',
        ...(correlationId ? { [CORRELATION_METADATA_KEY]: correlationId } : {})
      },
    });
    if (!response.ok) {
      logger.warn('Analytics Service /popular-routes returned', response.status);
      return [];
    }
    const routes = await response.json();
    return Array.isArray(routes) ? routes : [];
  } catch (err) {
    logger.warn('Analytics Service unavailable for popular routes', err.message);
    return [];
  }
}

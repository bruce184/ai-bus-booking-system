// TN-2: consumes `search-events` and updates analytics_daily.search_count.
import { upsertSearchCount } from "../../repository/analyticsRepository.js";
import { toMetricDate } from "../../utils/date.js";

export async function handleSearchEvent({ eventName, payload, occurredAt }) {
  if (eventName !== "trip.search_performed") {
    console.warn(`[analytics-service] unexpected search-events eventName: ${eventName}`);
    return;
  }

  const origin = String(payload?.origin ?? "").trim();
  const destination = String(payload?.destination ?? "").trim();

  if (!origin || !destination) {
    console.warn(
      "[analytics-service] trip.search_performed missing origin/destination; skipping",
      payload
    );
    return;
  }

  const metricDate = toMetricDate(occurredAt);
  const routeLabel = `${origin} -> ${destination}`;

  await upsertSearchCount({ metricDate, routeLabel });
}

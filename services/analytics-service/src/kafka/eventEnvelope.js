function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Parse the canonical analytics envelope and, for search-events only, accept
 * the legacy flat envelope so messages already queued before the producer
 * migration are not lost.
 */
export function parseAnalyticsEvent(rawValue, { allowLegacyFlat = false } = {}) {
  const parsed = JSON.parse(String(rawValue));

  if (!isRecord(parsed)) {
    throw new Error("Analytics event must be a JSON object");
  }

  if (typeof parsed.eventName === "string" && parsed.eventName.trim()) {
    if (!isRecord(parsed.payload)) {
      throw new Error("Canonical analytics event payload must be an object");
    }

    return {
      eventId: typeof parsed.eventId === "string" && parsed.eventId.trim() ? parsed.eventId : null,
      eventName: parsed.eventName,
      payload: parsed.payload,
      occurredAt: parsed.occurredAt,
      correlationId: typeof parsed.correlationId === "string" && parsed.correlationId.trim()
        ? parsed.correlationId
        : null
    };
  }

  if (allowLegacyFlat && typeof parsed.event === "string" && parsed.event.trim()) {
    const { event: eventName, occurredAt, correlationId, ...payload } = parsed;
    return {
      eventId: null,
      eventName,
      payload,
      occurredAt,
      correlationId: typeof correlationId === "string" && correlationId.trim() ? correlationId : null
    };
  }

  throw new Error("Unsupported analytics event envelope");
}

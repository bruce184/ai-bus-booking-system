import { formatDateInTimeZone } from "@bus/shared/date.js";

export function toMetricDate(occurredAt = new Date().toISOString()) {
  const date = new Date(occurredAt);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return formatDateInTimeZone(safeDate);
}

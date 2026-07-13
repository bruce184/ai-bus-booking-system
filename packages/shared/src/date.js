export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

function validDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date value");
  }
  return date;
}

export function formatDateInTimeZone(value = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(validDate(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function businessDate(value = new Date(), dayOffset = 0) {
  const localDate = formatDateInTimeZone(value);
  const calendarDate = new Date(`${localDate}T00:00:00.000Z`);
  calendarDate.setUTCDate(calendarDate.getUTCDate() + dayOffset);
  return calendarDate.toISOString().slice(0, 10);
}

export function compactBusinessDate(value = new Date(), dayOffset = 0) {
  return businessDate(value, dayOffset).replaceAll("-", "");
}

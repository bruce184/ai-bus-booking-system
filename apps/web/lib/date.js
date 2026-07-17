const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

function formatBusinessDate(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function businessDate(value = new Date(), dayOffset = 0) {
  const localDate = formatBusinessDate(value);
  const calendarDate = new Date(`${localDate}T00:00:00.000Z`);
  calendarDate.setUTCDate(calendarDate.getUTCDate() + dayOffset);
  return calendarDate.toISOString().slice(0, 10);
}

export function businessDateTimeLocal(hours = 8, minutes = 0, dayOffset = 1) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${businessDate(new Date(), dayOffset)}T${pad(hours)}:${pad(minutes)}`;
}

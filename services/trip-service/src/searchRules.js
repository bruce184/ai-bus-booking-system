const DEPARTURE_ASC = 't.departure_time asc';
const DURATION = '(t.arrival_time - t.departure_time)';

const SORT_OPTIONS = {
  price: 't.price asc',
  price_asc: 't.price asc',
  lowest_price: 't.price asc',
  price_desc: 't.price desc',
  highest_price: 't.price desc',
  duration: `${DURATION} asc`,
  shortest_duration: `${DURATION} asc`,
  longest_duration: `${DURATION} desc`,
  departure: DEPARTURE_ASC,
  earliest: DEPARTURE_ASC,
  earliest_departure: DEPARTURE_ASC,
  latest_departure: 't.departure_time desc',
};

export function resolveSortBy(sortBy) {
  const key = String(sortBy || '').trim().toLowerCase().replace(/-/g, '_');
  return `${SORT_OPTIONS[key] || DEPARTURE_ASC}, t.id asc`;
}

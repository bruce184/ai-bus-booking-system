// Maps PostgreSQL rows to proto/trip.proto message shapes.
// proto-loader is configured with keepCase:true, so message fields use the
// snake_case names exactly as declared in the proto.

export function mapLocation(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    address: row.address || '',
  };
}

// A Stop row is route_stops joined with its location.
export function mapStop(row) {
  return {
    id: row.id,
    name: row.location_name,
    address: row.location_address || '',
    stop_type: row.stop_type,
    stop_order: row.stop_order,
    route_id: row.route_id,
    location_id: row.location_id,
  };
}

export function mapVehicleSeat(row) {
  return {
    id: row.id,
    label: row.seat_label,
    deck: row.deck,
    row: row.seat_row,
    column: row.seat_column,
  };
}

export function mapRoute(row, stops = []) {
  return {
    id: row.route_id ?? row.id,
    origin: mapLocation({
      id: row.origin_id,
      name: row.origin_name,
      type: row.origin_type,
      address: row.origin_address,
    }),
    destination: mapLocation({
      id: row.destination_id,
      name: row.destination_name,
      type: row.destination_type,
      address: row.destination_address,
    }),
    distance_km: row.distance_km || 0,
    stops,
  };
}

export function mapVehicle(row, seats = []) {
  return {
    id: row.vehicle_id ?? row.id,
    operator_name: row.operator_name,
    vehicle_code: row.vehicle_code,
    license_plate: row.license_plate || '',
    vehicle_type: row.vehicle_type,
    seat_count: row.seat_count || seats.length,
    seats,
  };
}

function durationMinutes(departure, arrival) {
  const ms = new Date(arrival).getTime() - new Date(departure).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

// Builds an SEO title such as "Ve xe TP.HCM di Da Lat ngay 20/06".
export function buildSeoTitle(origin, destination, departureTime, timezone) {
  const d = new Date(departureTime);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  return `Vé xe ${origin} đi ${destination} ngày ${day}/${month}`;
}

// Maps a fully-joined trip row to a proto Trip. `extras` carries computed fields.
export function mapTrip(row, { route, vehicle, availableSeats, seoTitle }) {
  return {
    id: row.id,
    route,
    vehicle,
    operator_name: row.operator_name,
    vehicle_type: row.vehicle_type,
    departure_time: new Date(row.departure_time).toISOString(),
    arrival_time: new Date(row.arrival_time).toISOString(),
    duration_minutes: durationMinutes(row.departure_time, row.arrival_time),
    price: row.price,
    available_seats: availableSeats,
    status: row.status,
    seo_title: seoTitle || '',
  };
}

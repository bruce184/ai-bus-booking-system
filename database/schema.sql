create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('ADMIN', 'STAFF', 'CUSTOMER')),
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('PROVINCE', 'CITY', 'STATION')),
  address text,
  created_at timestamptz not null default now()
);

create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  origin_location_id uuid not null references locations(id),
  destination_location_id uuid not null references locations(id),
  distance_km integer,
  created_at timestamptz not null default now(),
  unique (origin_location_id, destination_location_id)
);

create table if not exists route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  location_id uuid not null references locations(id),
  stop_type text not null check (stop_type in ('PICKUP', 'DROPOFF')),
  stop_order integer not null default 1
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  operator_name text not null,
  vehicle_code text not null unique,
  license_plate text,
  vehicle_type text not null,
  seat_count integer not null,
  created_at timestamptz not null default now()
);

create table if not exists vehicle_seats (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  seat_label text not null,
  deck integer not null default 1,
  seat_row integer not null,
  seat_column integer not null,
  unique (vehicle_id, seat_label)
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id),
  vehicle_id uuid not null references vehicles(id),
  departure_time timestamptz not null,
  arrival_time timestamptz not null,
  price integer not null check (price >= 0),
  status text not null default 'ACTIVE' check (status in ('DRAFT', 'ACTIVE', 'LOCKED', 'DEPARTED', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now()
);

create table if not exists trip_seats (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  seat_label text not null,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'HELD', 'BOOKED', 'BLOCKED')),
  booking_id uuid,
  updated_at timestamptz not null default now(),
  unique (trip_id, seat_label)
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  customer_user_id uuid references users(id),
  trip_id uuid not null references trips(id),
  contact_email text not null,
  contact_phone text,
  status text not null check (status in ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'TICKET_ISSUED', 'CHECKED_IN', 'COMPLETED', 'EXPIRED', 'CANCELLED')),
  total_amount integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table trip_seats
  add constraint fk_trip_seats_booking
  foreign key (booking_id) references bookings(id);

create table if not exists booking_passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  document_number text,
  seat_label text not null
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  passenger_id uuid not null references booking_passengers(id) on delete cascade,
  ticket_code text not null unique,
  qr_payload text not null,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists event_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists analytics_daily (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  route_label text,
  search_count integer not null default 0,
  paid_booking_count integer not null default 0,
  tickets_sold integer not null default 0,
  revenue integer not null default 0,
  unique (metric_date, route_label)
);

create index if not exists idx_locations_name on locations(name);
create index if not exists idx_routes_origin_destination on routes(origin_location_id, destination_location_id);
create index if not exists idx_trips_route_departure on trips(route_id, departure_time);
create index if not exists idx_trip_seats_trip_label on trip_seats(trip_id, seat_label);
create index if not exists idx_bookings_code on bookings(booking_code);
create index if not exists idx_bookings_email on bookings(contact_email);
create index if not exists idx_tickets_code on tickets(ticket_code);
create index if not exists idx_analytics_daily_date on analytics_daily(metric_date);

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
  distance_km integer check (distance_km is null or distance_km > 0),
  created_at timestamptz not null default now(),
  check (origin_location_id <> destination_location_id),
  unique (origin_location_id, destination_location_id)
);

create table if not exists route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  location_id uuid not null references locations(id),
  stop_type text not null check (stop_type in ('PICKUP', 'DROPOFF')),
  stop_order integer not null default 1 check (stop_order > 0)
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  operator_name text not null,
  vehicle_code text not null unique,
  license_plate text,
  vehicle_type text not null,
  seat_count integer not null check (seat_count > 0),
  created_at timestamptz not null default now()
);

create table if not exists vehicle_seats (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  seat_label text not null,
  deck integer not null default 1 check (deck between 1 and 2),
  seat_row integer not null check (seat_row between 1 and 20),
  seat_column integer not null check (seat_column between 1 and 10),
  unique (vehicle_id, seat_label),
  unique (vehicle_id, deck, seat_row, seat_column)
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id),
  vehicle_id uuid not null references vehicles(id),
  departure_time timestamptz not null,
  arrival_time timestamptz not null,
  price integer not null check (price > 0),
  check (arrival_time > departure_time),
  status text not null default 'ACTIVE' check (status in ('DRAFT', 'ACTIVE', 'LOCKED', 'DEPARTED', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now()
);

create table if not exists trip_seats (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  seat_label text not null,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'HELD', 'BOOKED', 'BLOCKED')),
  block_reason text,
  booking_id uuid,
  updated_at timestamptz not null default now(),
  unique (trip_id, seat_label)
);

-- customer_user_id and trip_id are references into users/trips (owned by the
-- demo-auth identity issued through the GraphQL Gateway and by Trip Service),
-- not physical foreign keys: database-per-service (docs/ARCHITECTURE.md
-- section 11) means Booking Service does not share a constraint-enforced
-- schema boundary with those owners. trip_id existence/status is verified
-- through Trip Service's GetTripDetail RPC at booking-creation time instead
-- (services/booking-service/src/trip-client.js); customer_user_id is trusted
-- from the gateway's already-authenticated caller.
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  customer_user_id uuid,
  trip_id uuid not null,
  hold_token text unique,
  contact_email text not null,
  contact_phone text,
  status text not null check (status in ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'TICKET_ISSUED', 'CHECKED_IN', 'COMPLETED', 'EXPIRED', 'CANCELLED')),
  total_amount integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- trip_seats.booking_id is likewise a cross-service reference (Seat
-- Inventory Service -> Booking Service), set only by Booking Service's own
-- ConfirmSeats/ReleaseBookedSeats calls, not a physical foreign key.

create table if not exists booking_passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  document_number text,
  seat_label text not null
);

-- customer_user_id: see the note on bookings above - trusted from the
-- gateway's already-authenticated caller, not a physical foreign key.
create table if not exists saved_passengers (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null,
  full_name text not null,
  phone text,
  email text,
  document_number text,
  created_at timestamptz not null default now()
);

-- Ticket Worker is a separate runtime boundary. booking_id/passenger_id are
-- logical references validated from the canonical booking.paid event, not
-- physical foreign keys into Booking Service tables.
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  passenger_id uuid not null,
  ticket_code text not null unique,
  qr_payload text not null,
  ticket_html text,
  ticket_pdf_url text,
  checkin_policy_snapshot text,
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
  search_to_paid_rate numeric(5, 2) not null default 0,
  unique (metric_date, route_label)
);

-- Consumer idempotency for at-least-once Kafka delivery (analytics service).
create table if not exists processed_events (
  event_id uuid primary key,
  topic text not null,
  processed_at timestamptz not null default now()
);

-- Transactional outbox: producers insert a row in the same DB transaction as
-- their business write, so an event can never be lost to a broker outage.
-- A poller (dispatchOutboxEvents in @bus/shared/outbox.js) publishes
-- unpublished rows and stamps published_at; failures just retry next tick.
create table if not exists outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_name text not null,
  target text not null check (target in ('RABBITMQ', 'KAFKA')),
  routing_key text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- Keep schema.sql re-runnable against volumes created before service-boundary
-- foreign keys were removed.
alter table trip_seats drop constraint if exists trip_seats_trip_id_fkey;
alter table tickets drop constraint if exists tickets_booking_id_fkey;
alter table tickets drop constraint if exists tickets_passenger_id_fkey;

-- RabbitMQ consumers use a consumer-specific key because multiple queues may
-- legitimately process the same canonical eventId. The claim is inserted in
-- the same local transaction as the consumer's business writes.
create table if not exists workflow_processed_events (
  consumer_name text not null,
  event_id text not null,
  processed_at timestamptz not null default now(),
  primary key (consumer_name, event_id)
);

-- Keep schema.sql re-runnable against volumes created before event identity
-- was persisted in the outbox. A retry must reuse the same eventId and
-- occurredAt or an idempotent consumer cannot recognize the redelivery.
alter table outbox_events add column if not exists event_id uuid;
alter table outbox_events add column if not exists occurred_at timestamptz;
update outbox_events set event_id = gen_random_uuid() where event_id is null;
update outbox_events set occurred_at = created_at where occurred_at is null;
alter table outbox_events alter column event_id set default gen_random_uuid();
alter table outbox_events alter column event_id set not null;
alter table outbox_events alter column occurred_at set default now();
alter table outbox_events alter column occurred_at set not null;

drop index if exists idx_outbox_events_event_id;
create unique index idx_outbox_events_event_id
  on outbox_events(event_id, target, routing_key);
create index if not exists idx_outbox_events_unpublished on outbox_events(created_at) where published_at is null;

create index if not exists idx_locations_name on locations(name);
create index if not exists idx_routes_origin_destination on routes(origin_location_id, destination_location_id);
create unique index if not exists idx_vehicle_seats_label_ci on vehicle_seats(vehicle_id, lower(seat_label));
create index if not exists idx_trips_route_departure on trips(route_id, departure_time);
create index if not exists idx_trip_seats_trip_label on trip_seats(trip_id, seat_label);
create index if not exists idx_bookings_code on bookings(booking_code);
create index if not exists idx_bookings_email on bookings(contact_email);
create index if not exists idx_saved_passengers_user on saved_passengers(customer_user_id);
create index if not exists idx_tickets_code on tickets(ticket_code);
create index if not exists idx_analytics_daily_date on analytics_daily(metric_date);

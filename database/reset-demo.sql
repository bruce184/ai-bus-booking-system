\set ON_ERROR_STOP on

\ir schema.sql

begin;
truncate table
  workflow_processed_events,
  processed_events,
  outbox_events,
  event_logs,
  tickets,
  booking_passengers,
  saved_passengers,
  bookings,
  trip_seats,
  route_stops,
  trips,
  routes,
  vehicle_seats,
  vehicles,
  locations,
  users,
  analytics_daily
restart identity cascade;
commit;

\ir seed.sql

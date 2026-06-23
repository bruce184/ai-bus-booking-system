-- Demo seed data for the local Intercity Bus Booking AI MVP.
-- All values are fake and deterministic so the seed can be rerun safely in a local demo database.

insert into users (id, email, full_name, role) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.com', 'Admin Demo', 'ADMIN'),
  ('00000000-0000-4000-8000-000000000002', 'staff@example.com', 'Staff Demo', 'STAFF'),
  ('00000000-0000-4000-8000-000000000003', 'customer@example.com', 'Customer Demo', 'CUSTOMER')
on conflict (email) do update set
  id = excluded.id,
  full_name = excluded.full_name,
  role = excluded.role;

insert into locations (id, name, type, address) values
  ('00000000-0000-4000-8001-000000000001', 'TP.HCM', 'CITY', 'Ho Chi Minh City'),
  ('00000000-0000-4000-8001-000000000002', 'Da Lat', 'CITY', 'Lam Dong'),
  ('00000000-0000-4000-8001-000000000003', 'Nha Trang', 'CITY', 'Khanh Hoa'),
  ('00000000-0000-4000-8001-000000000004', 'Can Tho', 'CITY', 'Can Tho'),
  ('00000000-0000-4000-8001-000000000005', 'Da Nang', 'CITY', 'Da Nang'),
  ('00000000-0000-4000-8001-000000000006', 'Ha Noi', 'CITY', 'Ha Noi'),
  ('00000000-0000-4000-8001-000000000101', 'Mien Dong', 'STATION', '292 Dinh Bo Linh, TP.HCM'),
  ('00000000-0000-4000-8001-000000000102', 'Mien Tay', 'STATION', '395 Kinh Duong Vuong, TP.HCM'),
  ('00000000-0000-4000-8001-000000000103', 'Lien tinh Da Lat', 'STATION', '01 To Hien Thanh, Da Lat'),
  ('00000000-0000-4000-8001-000000000104', 'Nha Trang phia Nam', 'STATION', '58 Duong 23/10, Nha Trang'),
  ('00000000-0000-4000-8001-000000000105', 'Da Nang Central', 'STATION', '201 Ton Duc Thang, Da Nang'),
  ('00000000-0000-4000-8001-000000000106', 'Giap Bat', 'STATION', 'Giai Phong, Ha Noi')
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  address = excluded.address;

insert into vehicles (id, operator_name, vehicle_code, license_plate, vehicle_type, seat_count) values
  ('00000000-0000-4000-8002-000000000001', 'Phuong Trang Demo', 'PT-SLEEPER-34-01', '51B-12345', 'sleeper_34', 34),
  ('00000000-0000-4000-8002-000000000002', 'Thanh Buoi Demo', 'TB-LIMO-22-01', '51B-22222', 'limousine_22', 22),
  ('00000000-0000-4000-8002-000000000003', 'Kumho Demo', 'KH-SEAT-29-01', '51B-33333', 'seat_29', 29)
on conflict (vehicle_code) do update set
  id = excluded.id,
  operator_name = excluded.operator_name,
  license_plate = excluded.license_plate,
  vehicle_type = excluded.vehicle_type,
  seat_count = excluded.seat_count;

insert into vehicle_seats (vehicle_id, seat_label, deck, seat_row, seat_column)
select
  '00000000-0000-4000-8002-000000000001'::uuid,
  case
    when seat_number <= 17 then 'A' || lpad(seat_number::text, 2, '0')
    else 'B' || lpad((seat_number - 17)::text, 2, '0')
  end,
  case when seat_number <= 17 then 1 else 2 end,
  (((case when seat_number <= 17 then seat_number else seat_number - 17 end) - 1) / 2) + 1,
  (((case when seat_number <= 17 then seat_number else seat_number - 17 end) - 1) % 2) + 1
from generate_series(1, 34) as seat_number
on conflict (vehicle_id, seat_label) do update set
  deck = excluded.deck,
  seat_row = excluded.seat_row,
  seat_column = excluded.seat_column;

insert into vehicle_seats (vehicle_id, seat_label, deck, seat_row, seat_column)
select
  '00000000-0000-4000-8002-000000000002'::uuid,
  'L' || lpad(seat_number::text, 2, '0'),
  1,
  ((seat_number - 1) / 2) + 1,
  ((seat_number - 1) % 2) + 1
from generate_series(1, 22) as seat_number
on conflict (vehicle_id, seat_label) do update set
  deck = excluded.deck,
  seat_row = excluded.seat_row,
  seat_column = excluded.seat_column;

insert into vehicle_seats (vehicle_id, seat_label, deck, seat_row, seat_column)
select
  '00000000-0000-4000-8002-000000000003'::uuid,
  'S' || lpad(seat_number::text, 2, '0'),
  1,
  ((seat_number - 1) / 3) + 1,
  ((seat_number - 1) % 3) + 1
from generate_series(1, 29) as seat_number
on conflict (vehicle_id, seat_label) do update set
  deck = excluded.deck,
  seat_row = excluded.seat_row,
  seat_column = excluded.seat_column;

insert into routes (id, origin_location_id, destination_location_id, distance_km) values
  ('00000000-0000-4000-8003-000000000001', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8001-000000000002', 310),
  ('00000000-0000-4000-8003-000000000002', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8001-000000000003', 430),
  ('00000000-0000-4000-8003-000000000003', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8001-000000000004', 170),
  ('00000000-0000-4000-8003-000000000004', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8001-000000000006', 770),
  ('00000000-0000-4000-8003-000000000005', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8001-000000000005', 960)
on conflict (origin_location_id, destination_location_id) do update set
  id = excluded.id,
  distance_km = excluded.distance_km;

insert into route_stops (id, route_id, location_id, stop_type, stop_order) values
  ('00000000-0000-4000-8003-000000000101', '00000000-0000-4000-8003-000000000001', '00000000-0000-4000-8001-000000000101', 'PICKUP', 1),
  ('00000000-0000-4000-8003-000000000102', '00000000-0000-4000-8003-000000000001', '00000000-0000-4000-8001-000000000103', 'DROPOFF', 1),
  ('00000000-0000-4000-8003-000000000103', '00000000-0000-4000-8003-000000000002', '00000000-0000-4000-8001-000000000101', 'PICKUP', 1),
  ('00000000-0000-4000-8003-000000000104', '00000000-0000-4000-8003-000000000002', '00000000-0000-4000-8001-000000000104', 'DROPOFF', 1),
  ('00000000-0000-4000-8003-000000000105', '00000000-0000-4000-8003-000000000003', '00000000-0000-4000-8001-000000000102', 'PICKUP', 1),
  ('00000000-0000-4000-8003-000000000106', '00000000-0000-4000-8003-000000000003', '00000000-0000-4000-8001-000000000004', 'DROPOFF', 1),
  ('00000000-0000-4000-8003-000000000107', '00000000-0000-4000-8003-000000000004', '00000000-0000-4000-8001-000000000105', 'PICKUP', 1),
  ('00000000-0000-4000-8003-000000000108', '00000000-0000-4000-8003-000000000004', '00000000-0000-4000-8001-000000000106', 'DROPOFF', 1),
  ('00000000-0000-4000-8003-000000000109', '00000000-0000-4000-8003-000000000005', '00000000-0000-4000-8001-000000000101', 'PICKUP', 1),
  ('00000000-0000-4000-8003-000000000110', '00000000-0000-4000-8003-000000000005', '00000000-0000-4000-8001-000000000105', 'DROPOFF', 1)
on conflict (id) do update set
  route_id = excluded.route_id,
  location_id = excluded.location_id,
  stop_type = excluded.stop_type,
  stop_order = excluded.stop_order;

insert into trips (id, route_id, vehicle_id, departure_time, arrival_time, price, status) values
  ('00000000-0000-4000-8004-000000000001', '00000000-0000-4000-8003-000000000001', '00000000-0000-4000-8002-000000000001', '2026-06-24 20:00:00+07', '2026-06-25 03:30:00+07', 280000, 'ACTIVE'),
  ('00000000-0000-4000-8004-000000000002', '00000000-0000-4000-8003-000000000001', '00000000-0000-4000-8002-000000000002', '2026-06-25 08:00:00+07', '2026-06-25 15:30:00+07', 360000, 'ACTIVE'),
  ('00000000-0000-4000-8004-000000000003', '00000000-0000-4000-8003-000000000001', '00000000-0000-4000-8002-000000000003', '2026-06-26 21:00:00+07', '2026-06-27 04:30:00+07', 240000, 'LOCKED'),
  ('00000000-0000-4000-8004-000000000004', '00000000-0000-4000-8003-000000000002', '00000000-0000-4000-8002-000000000001', '2026-06-24 21:00:00+07', '2026-06-25 06:00:00+07', 320000, 'ACTIVE'),
  ('00000000-0000-4000-8004-000000000005', '00000000-0000-4000-8003-000000000002', '00000000-0000-4000-8002-000000000002', '2026-06-25 09:30:00+07', '2026-06-25 18:00:00+07', 420000, 'ACTIVE'),
  ('00000000-0000-4000-8004-000000000006', '00000000-0000-4000-8003-000000000003', '00000000-0000-4000-8002-000000000003', '2026-06-24 07:00:00+07', '2026-06-24 11:00:00+07', 180000, 'ACTIVE'),
  ('00000000-0000-4000-8004-000000000007', '00000000-0000-4000-8003-000000000003', '00000000-0000-4000-8002-000000000002', '2026-06-25 14:00:00+07', '2026-06-25 18:00:00+07', 250000, 'ACTIVE'),
  ('00000000-0000-4000-8004-000000000008', '00000000-0000-4000-8003-000000000004', '00000000-0000-4000-8002-000000000001', '2026-06-24 19:00:00+07', '2026-06-25 11:00:00+07', 520000, 'ACTIVE'),
  ('00000000-0000-4000-8004-000000000009', '00000000-0000-4000-8003-000000000004', '00000000-0000-4000-8002-000000000002', '2026-06-26 17:00:00+07', '2026-06-27 09:00:00+07', 680000, 'DRAFT'),
  ('00000000-0000-4000-8004-000000000010', '00000000-0000-4000-8003-000000000005', '00000000-0000-4000-8002-000000000001', '2026-06-25 18:00:00+07', '2026-06-26 11:00:00+07', 560000, 'ACTIVE'),
  ('00000000-0000-4000-8004-000000000011', '00000000-0000-4000-8003-000000000005', '00000000-0000-4000-8002-000000000003', '2026-06-27 06:00:00+07', '2026-06-27 22:00:00+07', 430000, 'CANCELLED'),
  ('00000000-0000-4000-8004-000000000012', '00000000-0000-4000-8003-000000000002', '00000000-0000-4000-8002-000000000003', '2026-06-28 20:30:00+07', '2026-06-29 05:30:00+07', 300000, 'ACTIVE')
on conflict (id) do update set
  route_id = excluded.route_id,
  vehicle_id = excluded.vehicle_id,
  departure_time = excluded.departure_time,
  arrival_time = excluded.arrival_time,
  price = excluded.price,
  status = excluded.status;

insert into trip_seats (trip_id, seat_label, status, block_reason)
select trips.id, vehicle_seats.seat_label, 'AVAILABLE', null
from trips
join vehicle_seats on vehicle_seats.vehicle_id = trips.vehicle_id
where trips.id between '00000000-0000-4000-8004-000000000001'::uuid and '00000000-0000-4000-8004-000000000012'::uuid
on conflict (trip_id, seat_label) do nothing;

insert into bookings (id, booking_code, customer_user_id, trip_id, contact_email, contact_phone, status, total_amount, created_at, updated_at) values
  ('00000000-0000-4000-8005-000000000001', 'BK202606240001', null, '00000000-0000-4000-8004-000000000001', 'guest.anna@example.com', '0900000001', 'TICKET_ISSUED', 280000, '2026-06-18 09:15:00+07', '2026-06-18 09:20:00+07'),
  ('00000000-0000-4000-8005-000000000002', 'BK202606240002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8004-000000000001', 'customer@example.com', '0900000002', 'PAID', 560000, '2026-06-19 10:00:00+07', '2026-06-19 10:05:00+07'),
  ('00000000-0000-4000-8005-000000000003', 'BK202606240003', null, '00000000-0000-4000-8004-000000000004', 'guest.binh@example.com', '0900000003', 'CHECKED_IN', 320000, '2026-06-20 11:30:00+07', '2026-06-24 20:15:00+07'),
  ('00000000-0000-4000-8005-000000000004', 'BK202606240004', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8004-000000000006', 'customer@example.com', '0900000004', 'COMPLETED', 180000, '2026-06-21 08:00:00+07', '2026-06-24 11:10:00+07'),
  ('00000000-0000-4000-8005-000000000005', 'BK202606240005', null, '00000000-0000-4000-8004-000000000008', 'guest.chi@example.com', '0900000005', 'PAID', 520000, '2026-06-22 14:45:00+07', '2026-06-22 14:50:00+07'),
  ('00000000-0000-4000-8005-000000000006', 'BK202606250001', null, '00000000-0000-4000-8004-000000000002', 'guest.dung@example.com', '0900000006', 'PENDING_PAYMENT', 360000, '2026-06-23 09:05:00+07', '2026-06-23 09:05:00+07'),
  ('00000000-0000-4000-8005-000000000007', 'BK202606250002', null, '00000000-0000-4000-8004-000000000005', 'guest.em@example.com', '0900000007', 'CANCELLED', 420000, '2026-06-22 17:20:00+07', '2026-06-23 12:00:00+07'),
  ('00000000-0000-4000-8005-000000000008', 'BK202606250003', null, '00000000-0000-4000-8004-000000000010', 'guest.giang@example.com', '0900000008', 'EXPIRED', 560000, '2026-06-23 18:30:00+07', '2026-06-23 18:45:00+07')
on conflict (booking_code) do update set
  id = excluded.id,
  customer_user_id = excluded.customer_user_id,
  trip_id = excluded.trip_id,
  contact_email = excluded.contact_email,
  contact_phone = excluded.contact_phone,
  status = excluded.status,
  total_amount = excluded.total_amount,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into booking_passengers (id, booking_id, full_name, phone, email, document_number, seat_label) values
  ('00000000-0000-4000-8006-000000000001', '00000000-0000-4000-8005-000000000001', 'Anna Demo', '0900000001', 'guest.anna@example.com', 'DD000001', 'A01'),
  ('00000000-0000-4000-8006-000000000002', '00000000-0000-4000-8005-000000000002', 'Customer Demo', '0900000002', 'customer@example.com', 'DD000002', 'A02'),
  ('00000000-0000-4000-8006-000000000003', '00000000-0000-4000-8005-000000000002', 'Family Demo', '0900000002', 'family.demo@example.com', 'DD000003', 'A03'),
  ('00000000-0000-4000-8006-000000000004', '00000000-0000-4000-8005-000000000003', 'Binh Demo', '0900000003', 'guest.binh@example.com', 'DD000004', 'A01'),
  ('00000000-0000-4000-8006-000000000005', '00000000-0000-4000-8005-000000000004', 'Customer Saved Demo', '0900000004', 'customer@example.com', 'DD000005', 'S01'),
  ('00000000-0000-4000-8006-000000000006', '00000000-0000-4000-8005-000000000005', 'Chi Demo', '0900000005', 'guest.chi@example.com', 'DD000006', 'A01'),
  ('00000000-0000-4000-8006-000000000007', '00000000-0000-4000-8005-000000000006', 'Dung Demo', '0900000006', 'guest.dung@example.com', 'DD000007', 'L01'),
  ('00000000-0000-4000-8006-000000000008', '00000000-0000-4000-8005-000000000007', 'Em Demo', '0900000007', 'guest.em@example.com', 'DD000008', 'L02'),
  ('00000000-0000-4000-8006-000000000009', '00000000-0000-4000-8005-000000000008', 'Giang Demo', '0900000008', 'guest.giang@example.com', 'DD000009', 'A04')
on conflict (id) do update set
  booking_id = excluded.booking_id,
  full_name = excluded.full_name,
  phone = excluded.phone,
  email = excluded.email,
  document_number = excluded.document_number,
  seat_label = excluded.seat_label;

insert into saved_passengers (id, customer_user_id, full_name, phone, email, document_number) values
  ('00000000-0000-4000-8008-000000000001', '00000000-0000-4000-8000-000000000003', 'Customer Demo', '0900000002', 'customer@example.com', 'DD000002'),
  ('00000000-0000-4000-8008-000000000002', '00000000-0000-4000-8000-000000000003', 'Family Demo', '0900000009', 'family.demo@example.com', 'DD000010')
on conflict (id) do update set
  customer_user_id = excluded.customer_user_id,
  full_name = excluded.full_name,
  phone = excluded.phone,
  email = excluded.email,
  document_number = excluded.document_number;

insert into tickets (id, booking_id, passenger_id, ticket_code, qr_payload, ticket_html, ticket_pdf_url, checkin_policy_snapshot, checked_in_at, created_at) values
  ('00000000-0000-4000-8007-000000000001', '00000000-0000-4000-8005-000000000001', '00000000-0000-4000-8006-000000000001', 'TK202606240001', 'BK202606240001-TK202606240001', '<p>Demo ticket BK202606240001 seat A01</p>', null, 'Arrive 30 minutes before departure with a valid demo ticket.', null, '2026-06-18 09:21:00+07'),
  ('00000000-0000-4000-8007-000000000002', '00000000-0000-4000-8005-000000000002', '00000000-0000-4000-8006-000000000002', 'TK202606240002', 'BK202606240002-TK202606240002', '<p>Demo ticket BK202606240002 seat A02</p>', null, 'Arrive 30 minutes before departure with a valid demo ticket.', null, '2026-06-19 10:06:00+07'),
  ('00000000-0000-4000-8007-000000000003', '00000000-0000-4000-8005-000000000002', '00000000-0000-4000-8006-000000000003', 'TK202606240003', 'BK202606240002-TK202606240003', '<p>Demo ticket BK202606240002 seat A03</p>', null, 'Arrive 30 minutes before departure with a valid demo ticket.', null, '2026-06-19 10:06:00+07'),
  ('00000000-0000-4000-8007-000000000004', '00000000-0000-4000-8005-000000000003', '00000000-0000-4000-8006-000000000004', 'TK202606240004', 'BK202606240003-TK202606240004', '<p>Demo ticket BK202606240003 seat A01</p>', null, 'Arrive 30 minutes before departure with a valid demo ticket.', '2026-06-24 20:15:00+07', '2026-06-20 11:35:00+07'),
  ('00000000-0000-4000-8007-000000000005', '00000000-0000-4000-8005-000000000004', '00000000-0000-4000-8006-000000000005', 'TK202606240005', 'BK202606240004-TK202606240005', '<p>Demo ticket BK202606240004 seat S01</p>', null, 'Arrive 30 minutes before departure with a valid demo ticket.', '2026-06-24 06:40:00+07', '2026-06-21 08:05:00+07'),
  ('00000000-0000-4000-8007-000000000006', '00000000-0000-4000-8005-000000000005', '00000000-0000-4000-8006-000000000006', 'TK202606240006', 'BK202606240005-TK202606240006', '<p>Demo ticket BK202606240005 seat A01</p>', null, 'Arrive 30 minutes before departure with a valid demo ticket.', null, '2026-06-22 14:51:00+07')
on conflict (ticket_code) do update set
  id = excluded.id,
  booking_id = excluded.booking_id,
  passenger_id = excluded.passenger_id,
  qr_payload = excluded.qr_payload,
  ticket_html = excluded.ticket_html,
  ticket_pdf_url = excluded.ticket_pdf_url,
  checkin_policy_snapshot = excluded.checkin_policy_snapshot,
  checked_in_at = excluded.checked_in_at,
  created_at = excluded.created_at;

update trip_seats set status = 'AVAILABLE', block_reason = null, booking_id = null
where trip_id between '00000000-0000-4000-8004-000000000001'::uuid and '00000000-0000-4000-8004-000000000012'::uuid;

update trip_seats set status = 'BOOKED', booking_id = '00000000-0000-4000-8005-000000000001'
where trip_id = '00000000-0000-4000-8004-000000000001' and seat_label = 'A01';

update trip_seats set status = 'BOOKED', booking_id = '00000000-0000-4000-8005-000000000002'
where trip_id = '00000000-0000-4000-8004-000000000001' and seat_label in ('A02', 'A03');

update trip_seats set status = 'BOOKED', booking_id = '00000000-0000-4000-8005-000000000003'
where trip_id = '00000000-0000-4000-8004-000000000004' and seat_label = 'A01';

update trip_seats set status = 'BOOKED', booking_id = '00000000-0000-4000-8005-000000000004'
where trip_id = '00000000-0000-4000-8004-000000000006' and seat_label = 'S01';

update trip_seats set status = 'BOOKED', booking_id = '00000000-0000-4000-8005-000000000005'
where trip_id = '00000000-0000-4000-8004-000000000008' and seat_label = 'A01';

update trip_seats set status = 'HELD', booking_id = '00000000-0000-4000-8005-000000000006'
where trip_id = '00000000-0000-4000-8004-000000000002' and seat_label = 'L01';

update trip_seats set status = 'BLOCKED', block_reason = 'Maintenance demo block'
where trip_id = '00000000-0000-4000-8004-000000000001' and seat_label = 'A10';

update trip_seats set status = 'BLOCKED', block_reason = 'Reserved for operator staff'
where trip_id = '00000000-0000-4000-8004-000000000002' and seat_label = 'L05';

update trip_seats set status = 'BLOCKED', block_reason = 'Window repair demo'
where trip_id = '00000000-0000-4000-8004-000000000010' and seat_label = 'B02';

insert into event_logs (id, event_type, entity_type, entity_id, payload, created_at) values
  ('00000000-0000-4000-8009-000000000001', 'trip.created', 'trip', '00000000-0000-4000-8004-000000000001', '{"route":"TP.HCM -> Da Lat","operator":"Phuong Trang Demo"}', '2026-06-17 08:00:00+07'),
  ('00000000-0000-4000-8009-000000000002', 'booking.paid', 'booking', '00000000-0000-4000-8005-000000000002', '{"bookingCode":"BK202606240002","amount":560000}', '2026-06-19 10:05:00+07'),
  ('00000000-0000-4000-8009-000000000003', 'ticket.issued', 'booking', '00000000-0000-4000-8005-000000000002', '{"ticketCodes":["TK202606240002","TK202606240003"]}', '2026-06-19 10:06:00+07'),
  ('00000000-0000-4000-8009-000000000004', 'seat.blocked', 'trip', '00000000-0000-4000-8004-000000000001', '{"seat":"A10","reason":"Maintenance demo block"}', '2026-06-20 09:00:00+07'),
  ('00000000-0000-4000-8009-000000000005', 'passenger.checked_in', 'booking', '00000000-0000-4000-8005-000000000003', '{"bookingCode":"BK202606240003","ticketCode":"TK202606240004"}', '2026-06-24 20:15:00+07'),
  ('00000000-0000-4000-8009-000000000006', 'booking.cancelled', 'booking', '00000000-0000-4000-8005-000000000007', '{"bookingCode":"BK202606250002"}', '2026-06-23 12:00:00+07'),
  ('00000000-0000-4000-8009-000000000007', 'trip.status_updated', 'trip', '00000000-0000-4000-8004-000000000003', '{"status":"LOCKED"}', '2026-06-23 16:30:00+07'),
  ('00000000-0000-4000-8009-000000000008', 'analytics.refreshed', 'analytics_daily', null, '{"days":7}', '2026-06-24 23:55:00+07')
on conflict (id) do update set
  event_type = excluded.event_type,
  entity_type = excluded.entity_type,
  entity_id = excluded.entity_id,
  payload = excluded.payload,
  created_at = excluded.created_at;

insert into analytics_daily (id, metric_date, route_label, search_count, paid_booking_count, tickets_sold, revenue, search_to_paid_rate) values
  ('00000000-0000-4000-8010-000000000001', '2026-06-18', 'TP.HCM -> Da Lat', 42, 1, 1, 280000, 2.38),
  ('00000000-0000-4000-8010-000000000002', '2026-06-19', 'TP.HCM -> Da Lat', 55, 1, 2, 560000, 1.82),
  ('00000000-0000-4000-8010-000000000003', '2026-06-20', 'TP.HCM -> Nha Trang', 38, 1, 1, 320000, 2.63),
  ('00000000-0000-4000-8010-000000000004', '2026-06-21', 'TP.HCM -> Can Tho', 31, 1, 1, 180000, 3.23),
  ('00000000-0000-4000-8010-000000000005', '2026-06-22', 'Da Nang -> Ha Noi', 47, 1, 1, 520000, 2.13),
  ('00000000-0000-4000-8010-000000000006', '2026-06-23', 'TP.HCM -> Nha Trang', 44, 0, 0, 0, 0.00),
  ('00000000-0000-4000-8010-000000000007', '2026-06-24', 'TP.HCM -> Da Nang', 63, 0, 0, 0, 0.00)
on conflict (metric_date, route_label) do update set
  id = excluded.id,
  search_count = excluded.search_count,
  paid_booking_count = excluded.paid_booking_count,
  tickets_sold = excluded.tickets_sold,
  revenue = excluded.revenue,
  search_to_paid_rate = excluded.search_to_paid_rate;

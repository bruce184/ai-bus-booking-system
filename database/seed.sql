insert into users (email, full_name, role) values
  ('admin@example.com', 'Admin Demo', 'ADMIN'),
  ('staff@example.com', 'Staff Demo', 'STAFF'),
  ('customer@example.com', 'Customer Demo', 'CUSTOMER')
on conflict (email) do nothing;

insert into locations (name, type, address) values
  ('TP.HCM', 'CITY', 'Ho Chi Minh City'),
  ('Da Lat', 'CITY', 'Lam Dong'),
  ('Nha Trang', 'CITY', 'Khanh Hoa'),
  ('Can Tho', 'CITY', 'Can Tho'),
  ('Da Nang', 'CITY', 'Da Nang'),
  ('Ha Noi', 'CITY', 'Ha Noi'),
  ('Mien Dong', 'STATION', 'TP.HCM'),
  ('Mien Tay', 'STATION', 'TP.HCM'),
  ('Lien tinh Da Lat', 'STATION', 'Da Lat'),
  ('Nha Trang phia Nam', 'STATION', 'Nha Trang')
on conflict do nothing;

insert into vehicles (operator_name, vehicle_code, license_plate, vehicle_type, seat_count) values
  ('Phuong Trang Demo', 'PT-SLEEPER-34-01', '51B-12345', 'sleeper_34', 34),
  ('Thanh Buoi Demo', 'TB-LIMO-22-01', '51B-22222', 'limousine_22', 22),
  ('Kumho Demo', 'KH-SEAT-29-01', '51B-33333', 'seat_29', 29)
on conflict (vehicle_code) do nothing;

-- =====================================================================
-- Trip-domain demo seed (owned by Trip Service / khoa).
-- Vehicle seat layouts, routes, route stops, trips, and trip seats.
-- All values are fake demo data. Statements are idempotent so the seed can
-- be re-applied without creating duplicates.
-- Booking, ticket, payment, and analytics seed remain for their owners.
-- =====================================================================

-- Vehicle seat layouts -------------------------------------------------
-- PT-SLEEPER-34-01: 2 decks x 17 seats (A* deck 1, B* deck 2)
insert into vehicle_seats (vehicle_id, seat_label, deck, seat_row, seat_column)
select v.id, 'A' || lpad(g::text, 2, '0'), 1, ((g - 1) / 3) + 1, ((g - 1) % 3) + 1
from vehicles v, generate_series(1, 17) g
where v.vehicle_code = 'PT-SLEEPER-34-01'
on conflict (vehicle_id, seat_label) do nothing;

insert into vehicle_seats (vehicle_id, seat_label, deck, seat_row, seat_column)
select v.id, 'B' || lpad(g::text, 2, '0'), 2, ((g - 1) / 3) + 1, ((g - 1) % 3) + 1
from vehicles v, generate_series(1, 17) g
where v.vehicle_code = 'PT-SLEEPER-34-01'
on conflict (vehicle_id, seat_label) do nothing;

-- TB-LIMO-22-01: 2 decks x 11 seats
insert into vehicle_seats (vehicle_id, seat_label, deck, seat_row, seat_column)
select v.id, 'A' || lpad(g::text, 2, '0'), 1, ((g - 1) / 2) + 1, ((g - 1) % 2) + 1
from vehicles v, generate_series(1, 11) g
where v.vehicle_code = 'TB-LIMO-22-01'
on conflict (vehicle_id, seat_label) do nothing;

insert into vehicle_seats (vehicle_id, seat_label, deck, seat_row, seat_column)
select v.id, 'B' || lpad(g::text, 2, '0'), 2, ((g - 1) / 2) + 1, ((g - 1) % 2) + 1
from vehicles v, generate_series(1, 11) g
where v.vehicle_code = 'TB-LIMO-22-01'
on conflict (vehicle_id, seat_label) do nothing;

-- KH-SEAT-29-01: single deck, 29 seats, 4 columns
insert into vehicle_seats (vehicle_id, seat_label, deck, seat_row, seat_column)
select v.id, 'A' || lpad(g::text, 2, '0'), 1, ((g - 1) / 4) + 1, ((g - 1) % 4) + 1
from vehicles v, generate_series(1, 29) g
where v.vehicle_code = 'KH-SEAT-29-01'
on conflict (vehicle_id, seat_label) do nothing;

-- Routes ---------------------------------------------------------------
insert into routes (origin_location_id, destination_location_id, distance_km)
select o.id, d.id, x.km
from (values
  ('TP.HCM', 'Da Lat', 310),
  ('TP.HCM', 'Nha Trang', 430),
  ('TP.HCM', 'Can Tho', 170),
  ('Da Lat', 'TP.HCM', 310)
) as x(origin, destination, km)
join locations o on o.name = x.origin
join locations d on d.name = x.destination
on conflict (origin_location_id, destination_location_id) do nothing;

-- Route stops (pickup/dropoff) ----------------------------------------
insert into route_stops (route_id, location_id, stop_type, stop_order)
select r.id, l.id, x.stop_type, x.stop_order
from (values
  ('TP.HCM', 'Da Lat', 'Mien Dong', 'PICKUP', 1),
  ('TP.HCM', 'Da Lat', 'Lien tinh Da Lat', 'DROPOFF', 1),
  ('TP.HCM', 'Nha Trang', 'Mien Dong', 'PICKUP', 1),
  ('TP.HCM', 'Nha Trang', 'Nha Trang phia Nam', 'DROPOFF', 1),
  ('TP.HCM', 'Can Tho', 'Mien Tay', 'PICKUP', 1),
  ('TP.HCM', 'Can Tho', 'Can Tho', 'DROPOFF', 1),
  ('Da Lat', 'TP.HCM', 'Lien tinh Da Lat', 'PICKUP', 1),
  ('Da Lat', 'TP.HCM', 'Mien Dong', 'DROPOFF', 1)
) as x(origin, destination, stop_name, stop_type, stop_order)
join locations o on o.name = x.origin
join locations d on d.name = x.destination
join routes r on r.origin_location_id = o.id and r.destination_location_id = d.id
join locations l on l.name = x.stop_name
where not exists (
  select 1 from route_stops rs
  where rs.route_id = r.id and rs.location_id = l.id and rs.stop_type = x.stop_type
);

-- Trips (dates are relative to current_date so demo trips are always upcoming).
-- Times are wall-clock in Asia/Ho_Chi_Minh.
insert into trips (route_id, vehicle_id, departure_time, arrival_time, price, status)
select r.id, v.id,
       timezone('Asia/Ho_Chi_Minh', current_date + (x.dep_day::text || ' day')::interval + x.dep_time::time),
       timezone('Asia/Ho_Chi_Minh', current_date + (x.arr_day::text || ' day')::interval + x.arr_time::time),
       x.price, 'ACTIVE'
from (values
  ('TP.HCM', 'Da Lat', 'PT-SLEEPER-34-01', 1, '21:00', 2, '00:30', 280000),
  ('TP.HCM', 'Da Lat', 'TB-LIMO-22-01',    2, '20:00', 2, '23:30', 320000),
  ('TP.HCM', 'Da Lat', 'KH-SEAT-29-01',    3, '07:00', 3, '13:00', 250000),
  ('TP.HCM', 'Da Lat', 'PT-SLEEPER-34-01', 5, '22:00', 6, '04:30', 270000),
  ('TP.HCM', 'Nha Trang', 'TB-LIMO-22-01', 2, '06:00', 2, '14:00', 350000),
  ('TP.HCM', 'Nha Trang', 'KH-SEAT-29-01', 4, '08:00', 4, '16:00', 300000),
  ('TP.HCM', 'Can Tho', 'KH-SEAT-29-01',   2, '09:00', 2, '13:00', 180000),
  ('Da Lat', 'TP.HCM', 'PT-SLEEPER-34-01', 3, '13:00', 3, '19:30', 280000)
) as x(origin, destination, vcode, dep_day, dep_time, arr_day, arr_time, price)
join locations o on o.name = x.origin
join locations d on d.name = x.destination
join routes r on r.origin_location_id = o.id and r.destination_location_id = d.id
join vehicles v on v.vehicle_code = x.vcode
where not exists (
  select 1 from trips t2
  where t2.route_id = r.id and t2.vehicle_id = v.id
    and t2.departure_time = timezone('Asia/Ho_Chi_Minh', current_date + (x.dep_day::text || ' day')::interval + x.dep_time::time)
);

-- Materialize trip seats from each trip's vehicle layout.
insert into trip_seats (trip_id, seat_label, status)
select t.id, vs.seat_label, 'AVAILABLE'
from trips t
join vehicle_seats vs on vs.vehicle_id = t.vehicle_id
where not exists (
  select 1 from trip_seats ts where ts.trip_id = t.id and ts.seat_label = vs.seat_label
);

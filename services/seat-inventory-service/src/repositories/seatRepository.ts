import { pool } from "../db/postgres.js";
import type { SeatStatus, TripSeatRecord } from "../seatTypes.js";

type TripSeatRow = {
  id: string;
  seat_label: string;
  deck: number;
  seat_row: number;
  seat_column: number;
  status: SeatStatus;
  block_reason: string | null;
};

export async function listTripSeats(tripId: string): Promise<TripSeatRecord[]> {
  const result = await pool.query<TripSeatRow>(
    `
      select
        ts.id,
        ts.seat_label,
        coalesce(vs.deck, 1) as deck,
        coalesce(vs.seat_row, 1) as seat_row,
        coalesce(vs.seat_column, 1) as seat_column,
        ts.status,
        ts.block_reason
      from trip_seats ts
      join trips t on t.id = ts.trip_id
      left join vehicle_seats vs
        on vs.vehicle_id = t.vehicle_id
       and vs.seat_label = ts.seat_label
      where ts.trip_id = $1
      order by coalesce(vs.deck, 1), coalesce(vs.seat_row, 1), coalesce(vs.seat_column, 1), ts.seat_label
    `,
    [tripId]
  );

  return result.rows.map((row) => ({
    id: row.seat_label,
    label: row.seat_label,
    deck: Number(row.deck),
    row: Number(row.seat_row),
    column: Number(row.seat_column),
    status: row.status,
    blockReason: row.block_reason
  }));
}

export async function listTripSeatsByIds(
  tripId: string,
  seatIds: string[]
): Promise<TripSeatRecord[]> {
  const result = await pool.query<TripSeatRow>(
    `
      select
        ts.id,
        ts.seat_label,
        coalesce(vs.deck, 1) as deck,
        coalesce(vs.seat_row, 1) as seat_row,
        coalesce(vs.seat_column, 1) as seat_column,
        ts.status,
        ts.block_reason
      from trip_seats ts
      join trips t on t.id = ts.trip_id
      left join vehicle_seats vs
        on vs.vehicle_id = t.vehicle_id
       and vs.seat_label = ts.seat_label
      where ts.trip_id = $1
        and ts.seat_label = any($2::text[])
      order by coalesce(vs.deck, 1), coalesce(vs.seat_row, 1), coalesce(vs.seat_column, 1), ts.seat_label
    `,
    [tripId, seatIds]
  );

  return result.rows.map((row) => ({
    id: row.seat_label,
    label: row.seat_label,
    deck: Number(row.deck),
    row: Number(row.seat_row),
    column: Number(row.seat_column),
    status: row.status,
    blockReason: row.block_reason
  }));
}

export async function confirmTripSeats(
  tripId: string,
  seatIds: string[],
  bookingId: string
): Promise<TripSeatRecord[]> {
  const result = await pool.query<TripSeatRow>(
    `
      with updated as (
        update trip_seats
           set status = 'BOOKED',
               booking_id = $3::uuid,
               updated_at = now()
         where trip_id = $1
           and seat_label = any($2::text[])
           and status not in ('BOOKED', 'BLOCKED')
         returning *
      )
      select
        updated.id,
        updated.seat_label,
        coalesce(vs.deck, 1) as deck,
        coalesce(vs.seat_row, 1) as seat_row,
        coalesce(vs.seat_column, 1) as seat_column,
        updated.status,
        updated.block_reason
      from updated
      join trips t on t.id = updated.trip_id
      left join vehicle_seats vs
        on vs.vehicle_id = t.vehicle_id
       and vs.seat_label = updated.seat_label
      order by coalesce(vs.deck, 1), coalesce(vs.seat_row, 1), coalesce(vs.seat_column, 1), updated.seat_label
    `,
    [tripId, seatIds, bookingId]
  );

  return result.rows.map((row) => ({
    id: row.seat_label,
    label: row.seat_label,
    deck: Number(row.deck),
    row: Number(row.seat_row),
    column: Number(row.seat_column),
    status: row.status,
    blockReason: row.block_reason
  }));
}

export async function blockTripSeats(
  tripId: string,
  seatIds: string[],
  reason: string | null
): Promise<TripSeatRecord[]> {
  const result = await pool.query<TripSeatRow>(
    `
      with updated as (
        update trip_seats
           set status = 'BLOCKED',
               block_reason = $3,
               booking_id = null,
               updated_at = now()
         where trip_id = $1
           and seat_label = any($2::text[])
           and status != 'BOOKED'
         returning *
      )
      select
        updated.id,
        updated.seat_label,
        coalesce(vs.deck, 1) as deck,
        coalesce(vs.seat_row, 1) as seat_row,
        coalesce(vs.seat_column, 1) as seat_column,
        updated.status,
        updated.block_reason
      from updated
      join trips t on t.id = updated.trip_id
      left join vehicle_seats vs
        on vs.vehicle_id = t.vehicle_id
       and vs.seat_label = updated.seat_label
      order by coalesce(vs.deck, 1), coalesce(vs.seat_row, 1), coalesce(vs.seat_column, 1), updated.seat_label
    `,
    [tripId, seatIds, reason]
  );

  return result.rows.map((row) => ({
    id: row.seat_label,
    label: row.seat_label,
    deck: Number(row.deck),
    row: Number(row.seat_row),
    column: Number(row.seat_column),
    status: row.status,
    blockReason: row.block_reason
  }));
}

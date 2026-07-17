import { pool } from "../db/postgres.js";

async function runTransaction(work, database = pool) {
  const client = await database.connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function lockTripSeats(client, tripId, seatIds) {
  const result = await client.query(
    `
      select id, seat_label, status, booking_id
      from trip_seats
      where trip_id = $1
        and seat_label = any($2::text[])
      order by seat_label
      for update
    `,
    [tripId, seatIds]
  );
  return result.rows;
}

function missingSeatId(rows, seatIds) {
  const found = new Set(rows.map((row) => row.seat_label));
  return seatIds.find((seatId) => !found.has(seatId)) || null;
}

export async function listTripSeats(tripId) {
  const result = await pool.query(
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

export async function listTripSeatsByIds(tripId, seatIds, client = pool) {
  const result = await client.query(
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
  tripId,
  seatIds,
  bookingId,
  validateHold,
  database = pool
) {
  return runTransaction(async (client) => {
    const lockedSeats = await lockTripSeats(client, tripId, seatIds);
    const missing = missingSeatId(lockedSeats, seatIds);
    if (missing) {
      return { outcome: "MISSING", seatId: missing, seats: [] };
    }

    const unavailable = lockedSeats.find(
      (seat) =>
        seat.status === "BLOCKED" ||
        (seat.status === "BOOKED" && String(seat.booking_id || "") !== bookingId)
    );
    if (unavailable) {
      return {
        outcome: "UNAVAILABLE",
        seatId: unavailable.seat_label,
        seatStatus: unavailable.status,
        seats: []
      };
    }

    const alreadyConfirmed = lockedSeats.every(
      (seat) => seat.status === "BOOKED" && String(seat.booking_id || "") === bookingId
    );
    if (!alreadyConfirmed) {
      await validateHold();
      const update = await client.query(
        `
          update trip_seats
          set status = 'BOOKED',
              booking_id = $3::uuid,
              block_reason = null,
              updated_at = now()
          where trip_id = $1
            and seat_label = any($2::text[])
            and (
              status not in ('BOOKED', 'BLOCKED')
              or (status = 'BOOKED' and booking_id = $3::uuid)
            )
        `,
        [tripId, seatIds, bookingId]
      );
      if (update.rowCount !== seatIds.length) {
        throw new Error("Atomic seat confirmation did not update every requested seat");
      }
    }

    return {
      outcome: "CONFIRMED",
      alreadyConfirmed,
      seats: await listTripSeatsByIds(tripId, seatIds, client)
    };
  }, database);
}

export async function releaseBookedTripSeats(tripId, seatIds, bookingId) {
  const result = await pool.query(
    `
      with updated as (
        update trip_seats
           set status = 'AVAILABLE',
               booking_id = null,
               updated_at = now()
         where trip_id = $1
           and seat_label = any($2::text[])
           and status = 'BOOKED'
           and booking_id = $3::uuid
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

export async function blockTripSeats(tripId, seatIds, reason, database = pool) {
  return runTransaction(async (client) => {
    const lockedSeats = await lockTripSeats(client, tripId, seatIds);
    const missing = missingSeatId(lockedSeats, seatIds);
    if (missing) {
      return { outcome: "MISSING", seatId: missing, seats: [] };
    }

    const booked = lockedSeats.find((seat) => seat.status === "BOOKED");
    if (booked) {
      return {
        outcome: "UNAVAILABLE",
        seatId: booked.seat_label,
        seatStatus: booked.status,
        seats: []
      };
    }

    const update = await client.query(
      `
        update trip_seats
        set status = 'BLOCKED',
            block_reason = $3,
            booking_id = null,
            updated_at = now()
        where trip_id = $1
          and seat_label = any($2::text[])
          and status != 'BOOKED'
      `,
      [tripId, seatIds, reason]
    );
    if (update.rowCount !== seatIds.length) {
      throw new Error("Atomic seat blocking did not update every requested seat");
    }

    return {
      outcome: "BLOCKED",
      seats: await listTripSeatsByIds(tripId, seatIds, client)
    };
  }, database);
}

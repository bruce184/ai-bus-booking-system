import pg from 'pg';

const { Pool } = pg;

const DEMO_TRIP_ID = '00000000-0000-4000-8004-000000000001';
const DEMO_BOOKING_ID = '00000000-0000-4000-8005-000000000001';

// Lazy pool: multiple spec files share this module in one worker, and each
// calls closeAdminE2EDatabase in afterAll. Recreate on demand so a later
// spec is not left with a pool another spec already ended.
let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
        || 'postgresql://bus_app:change_me_local_only@localhost:5432/bus_booking'
    });
  }
  return pool;
}

export const demoFixtures = {
  tripId: DEMO_TRIP_ID,
  bookingCode: 'BK202606240001',
  seatLabel: 'A04'
};

export async function resetAdminE2EFixtures() {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query(
      `update trip_seats
          set status = 'AVAILABLE', block_reason = null, booking_id = null, updated_at = now()
        where trip_id = $1 and seat_label = $2`,
      [DEMO_TRIP_ID, demoFixtures.seatLabel]
    );
    await client.query(
      "update bookings set status = 'TICKET_ISSUED', updated_at = now() where id = $1",
      [DEMO_BOOKING_ID]
    );
    await client.query(
      'update tickets set checked_in_at = null where booking_id = $1',
      [DEMO_BOOKING_ID]
    );
    await client.query(
      "delete from event_logs where event_type = 'ticket.checked_in' and entity_id = $1",
      [DEMO_BOOKING_ID]
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeAdminE2EDatabase() {
  if (pool) {
    const ending = pool.end();
    pool = null;
    await ending;
  }
}

// Removes bookings created by the customer-flow e2e (identified by their
// e2e-*@example.com contact email) and releases the seats they booked.
export async function cleanupCustomerE2EBookings() {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      "select id from bookings where contact_email like 'e2e-%@example.com'"
    );
    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
      await client.query(
        `update trip_seats
            set status = 'AVAILABLE', booking_id = null, updated_at = now()
          where booking_id = any($1::uuid[])`,
        [ids]
      );
      await client.query('delete from tickets where booking_id = any($1::uuid[])', [ids]);
      await client.query('delete from booking_passengers where booking_id = any($1::uuid[])', [ids]);
      await client.query('delete from bookings where id = any($1::uuid[])', [ids]);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

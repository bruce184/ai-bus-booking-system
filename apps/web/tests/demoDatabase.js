import pg from 'pg';

const { Pool } = pg;

const DEMO_TRIP_ID = '00000000-0000-4000-8004-000000000001';
const DEMO_BOOKING_ID = '00000000-0000-4000-8005-000000000001';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
    || 'postgresql://bus_app:change_me_local_only@localhost:5432/bus_booking'
});

export const demoFixtures = {
  tripId: DEMO_TRIP_ID,
  bookingCode: 'BK202606240001',
  seatLabel: 'A04'
};

export async function resetAdminE2EFixtures() {
  const client = await pool.connect();
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
  await pool.end();
}

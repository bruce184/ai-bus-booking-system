import { transaction } from "@bus/shared/db.js";
import { claimWorkflowEvent } from "@bus/shared/idempotency.js";
import { writeOutboxEvent } from "@bus/shared/outbox.js";

const CONSUMER_NAME = "booking-service.trip-completed";

export async function completeCheckedInBookings(
  event,
  { runTransaction = transaction } = {}
) {
  const tripId = String(event.payload?.tripId || event.payload?.trip_id || "").trim();
  if (!tripId) {
    throw new Error("trip.completed payload missing tripId");
  }

  const eventId = event.eventId || `legacy:trip.completed:${tripId}`;
  return runTransaction(async (client) => {
    if (!(await claimWorkflowEvent(client, CONSUMER_NAME, eventId))) {
      return { skipped: true, completedCount: 0 };
    }

    const result = await client.query(
      `
        update bookings
        set status = 'COMPLETED', updated_at = now()
        where trip_id = $1 and status = 'CHECKED_IN'
        returning id, booking_code, contact_email
      `,
      [tripId]
    );

    for (const booking of result.rows) {
      await client.query(
        "insert into event_logs (event_type, entity_type, entity_id, payload) values ($1, $2, $3, $4)",
        [
          "booking.completed",
          "booking",
          booking.id,
          JSON.stringify({ bookingCode: booking.booking_code, tripId })
        ]
      );
      await writeOutboxEvent(client, {
        aggregateType: "booking",
        aggregateId: booking.id,
        eventName: "booking.completed",
        target: "RABBITMQ",
        routingKey: "booking.completed",
        payload: {
          bookingId: booking.id,
          bookingCode: booking.booking_code,
          contactEmail: booking.contact_email,
          tripId
        }
      });
    }

    return {
      skipped: false,
      completedCount: result.rowCount
    };
  });
}

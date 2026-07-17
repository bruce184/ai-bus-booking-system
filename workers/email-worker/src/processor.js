import { query, transaction } from "@bus/shared/db.js";
import { claimWorkflowEvent } from "@bus/shared/idempotency.js";

const CONSUMER_NAME = "email-worker.notifications";

async function loadEmailSummary(bookingId, runQuery = query) {
  if (!bookingId) {
    return null;
  }
  const result = await runQuery(
    `
      select b.booking_code, b.contact_email, b.total_amount, b.status,
             count(tk.id)::int as ticket_count
      from bookings b
      left join tickets tk on tk.booking_id = b.id
      where b.id = $1
      group by b.id
    `,
    [bookingId]
  );
  return result.rows[0] || null;
}

function eventIdentity(event, bookingId, bookingCode) {
  if (event.eventId) {
    return event.eventId;
  }
  const aggregateId = bookingId || bookingCode;
  if (!aggregateId) {
    throw new Error("Email event requires eventId or booking identity");
  }
  return `legacy:${event.eventName || "email.requested"}:${aggregateId}`;
}

export async function processEmailEvent(
  event,
  {
    runQuery = query,
    runTransaction = transaction,
    claimEvent = claimWorkflowEvent,
    logger = console
  } = {}
) {
  const bookingId = event.payload?.bookingId;
  const bookingCode = event.payload?.bookingCode;
  const summary = await loadEmailSummary(bookingId, runQuery);
  const eventId = eventIdentity(event, bookingId, bookingCode);

  return runTransaction(async (client) => {
    if (!(await claimEvent(client, CONSUMER_NAME, eventId))) {
      return { skipped: true };
    }

    const message = {
      event: event.eventName,
      to: summary?.contact_email || event.payload?.contactEmail || "unknown",
      bookingCode: summary?.booking_code || bookingCode,
      status: summary?.status,
      ticketCount: summary?.ticket_count || event.payload?.ticketCount || 0,
      totalAmount: summary?.total_amount
    };
    logger.log("[email-worker] simulated email", message);
    return { skipped: false, message };
  });
}

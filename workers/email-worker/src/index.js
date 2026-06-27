import { query } from "@bus/shared/db.js";
import { createWorkflowConsumer } from "@bus/shared/events.js";

async function loadEmailSummary(bookingId) {
  const result = await query(
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
  return result.rows[0];
}

async function logEmail(event) {
  const bookingId = event.payload?.bookingId;
  const bookingCode = event.payload?.bookingCode;
  const summary = bookingId ? await loadEmailSummary(bookingId) : null;

  console.log("[email-worker] simulated email", {
    event: event.eventName,
    to: summary?.contact_email || event.payload?.contactEmail || "unknown",
    bookingCode: summary?.booking_code || bookingCode,
    status: summary?.status,
    ticketCount: summary?.ticket_count || event.payload?.ticketCount || 0,
    totalAmount: summary?.total_amount
  });
}

await createWorkflowConsumer(
  "email-worker.notifications",
  ["booking.paid", "ticket.issued", "email.requested"],
  logEmail
);
console.log("[email-worker] waiting for notification events");

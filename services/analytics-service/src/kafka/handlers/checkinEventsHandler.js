export async function handleCheckinEvent({ eventName, payload }) {
  if (eventName !== "ticket.checked_in") {
    console.warn(`[analytics-service] unexpected checkin-events eventName: ${eventName}`);
    return;
  }

  console.log(
    `[analytics-service] ticket.checked_in received for ticket ${payload?.ticketCode ?? "unknown"} (log only)`
  );
}

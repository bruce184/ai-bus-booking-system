export async function claimWorkflowEvent(client, consumerName, eventId) {
  if (!consumerName || !eventId) {
    throw new Error("consumerName and eventId are required for workflow idempotency");
  }

  const result = await client.query(
    `
      insert into workflow_processed_events (consumer_name, event_id)
      values ($1, $2)
      on conflict (consumer_name, event_id) do nothing
    `,
    [consumerName, eventId]
  );
  return result.rowCount === 1;
}

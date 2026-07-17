import { pool } from "./db.js";
import { getCorrelationId } from "./correlation.js";
import { publishKafkaEvent, publishWorkflowEvent } from "./events.js";

// Transactional outbox (Week 4 slide 37): call this inside the same
// transaction as the business write. `client` is the pg client the caller's
// transaction() gave it, so the insert commits or rolls back atomically with
// the state change it describes.
//
// correlationId defaults to the request/message currently in scope (set by
// the gRPC handler or workflow consumer wrapper that led here) so callers
// don't need to thread it through explicitly - it survives the gap between
// this write and the poller's later dispatch only because it's persisted here.
export async function writeOutboxEvent(
  client,
  {
    aggregateType,
    aggregateId,
    eventName,
    target,
    routingKey,
    payload,
    eventId,
    occurredAt,
    correlationId = getCorrelationId()
  }
) {
  await client.query(
    `
      insert into outbox_events (
        aggregate_type, aggregate_id, event_name, target, routing_key, payload, event_id, occurred_at, correlation_id
      )
      values ($1, $2, $3, $4, $5, $6, coalesce($7, gen_random_uuid()), coalesce($8, now()), $9)
    `,
    [
      aggregateType,
      aggregateId,
      eventName,
      target,
      routingKey,
      JSON.stringify(payload),
      eventId || null,
      occurredAt || null,
      correlationId || null
    ]
  );
}

// Each runtime must declare the aggregate types it owns. Rows are locked while
// publishing so concurrent service instances cannot dispatch the same row at
// the same time. A broker success followed by a database failure can still
// redeliver, which is the intended at-least-once contract; consumers claim the
// canonical eventId idempotently.
export async function dispatchOutboxEvents(
  {
    limit = 20,
    aggregateTypes,
    database = pool,
    publishWorkflow = publishWorkflowEvent,
    publishKafka = publishKafkaEvent,
    onError = (message) => console.error(message)
  } = {}
) {
  const ownedTypes = [...new Set(
    (aggregateTypes || []).map((value) => String(value || "").trim()).filter(Boolean)
  )];
  if (ownedTypes.length === 0) {
    throw new Error("dispatchOutboxEvents requires at least one owned aggregateType");
  }

  const boundedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const client = await database.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `
        select *
        from outbox_events
        where published_at is null
          and aggregate_type = any($1::text[])
        order by created_at
        for update skip locked
        limit $2
      `,
      [ownedTypes, boundedLimit]
    );

    for (const row of rows) {
      try {
        if (row.target === "RABBITMQ") {
          await publishWorkflow(row.event_name, row.payload, {
            eventId: row.event_id,
            occurredAt: row.occurred_at,
            routingKey: row.routing_key,
            correlationId: row.correlation_id ?? null
          });
        } else if (row.target === "KAFKA") {
          await publishKafka(row.routing_key, row.event_name, row.payload, {
            eventId: row.event_id,
            occurredAt: row.occurred_at,
            correlationId: row.correlation_id ?? null
          });
        } else {
          throw new Error(`Unsupported outbox target: ${row.target}`);
        }

        await client.query(
          "update outbox_events set published_at = now() where id = $1 and published_at is null",
          [row.id]
        );
      } catch (error) {
        onError(`[outbox] failed to publish ${row.event_name} (${row.id}): ${error.message}`);
      }
    }

    await client.query("commit");
    return rows.length;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

import { pool } from "./db.js";
import { publishKafkaEvent, publishWorkflowEvent } from "./events.js";

// Transactional outbox (Week 4 slide 37): call this inside the same
// transaction as the business write. `client` is the pg client the caller's
// transaction() gave it, so the insert commits or rolls back atomically with
// the state change it describes.
export async function writeOutboxEvent(
  client,
  { aggregateType, aggregateId, eventName, target, routingKey, payload }
) {
  await client.query(
    `
      insert into outbox_events (aggregate_type, aggregate_id, event_name, target, routing_key, payload)
      values ($1, $2, $3, $4, $5, $6)
    `,
    [aggregateType, aggregateId, eventName, target, routingKey, JSON.stringify(payload)]
  );
}

// ponytail: single-instance poller (no FOR UPDATE SKIP LOCKED) - this demo
// never runs more than one instance of a given service. Add row locking if
// that changes.
export async function dispatchOutboxEvents({ limit = 20 } = {}) {
  const { rows } = await pool.query(
    `select * from outbox_events where published_at is null order by created_at limit $1`,
    [limit]
  );

  for (const row of rows) {
    try {
      if (row.target === "RABBITMQ") {
        await publishWorkflowEvent(row.event_name, row.payload);
      } else {
        await publishKafkaEvent(row.routing_key, row.event_name, row.payload);
      }
      await pool.query(
        "update outbox_events set published_at = now() where id = $1 and published_at is null",
        [row.id]
      );
    } catch (error) {
      console.error(`[outbox] failed to publish ${row.event_name} (${row.id}): ${error.message}`);
    }
  }

  return rows.length;
}

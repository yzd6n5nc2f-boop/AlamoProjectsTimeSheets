import { createHash } from "node:crypto";
import { pool } from "../config/db.js";

interface WriteAuditEventInput {
  entityTable: string;
  entityPk: string;
  operation: string;
  actorEmployeeId?: number;
  actorRole?: string;
  requestId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  fieldChanges?: Array<{ fieldPath: string; oldValue: unknown; newValue: unknown }>;
}

function hashContent(content: string): Buffer {
  return createHash("sha256").update(content).digest();
}

export async function writeAuditEvent(input: WriteAuditEventInput): Promise<void> {
  const metadata = input.metadata ?? {};
  const fieldChanges = input.fieldChanges ?? [];

  const chainResult = await pool.query<{ event_hash: Buffer }>(
    "SELECT event_hash FROM audit_event ORDER BY id DESC LIMIT 1"
  );
  const prevHash = chainResult.rows[0]?.event_hash ?? null;

  const payloadHashInput = JSON.stringify({
    table: input.entityTable,
    pk: input.entityPk,
    op: input.operation,
    actor: input.actorEmployeeId,
    role: input.actorRole,
    requestId: input.requestId,
    reason: input.reason,
    metadata,
    fieldChanges,
    prevHash: prevHash?.toString("hex") ?? null
  });

  const eventHash = hashContent(payloadHashInput);

  const eventInsert = await pool.query<{ id: number }>(
    `
      INSERT INTO audit_event (
        entity_table,
        entity_pk,
        operation,
        actor_employee_id,
        actor_role,
        request_id,
        reason,
        source,
        metadata,
        prev_event_hash,
        event_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6::uuid, $7, 'api', $8::jsonb, $9, $10)
      RETURNING id
    `,
    [
      input.entityTable,
      input.entityPk,
      input.operation,
      input.actorEmployeeId ?? null,
      input.actorRole ?? null,
      input.requestId ?? null,
      input.reason ?? null,
      JSON.stringify(metadata),
      prevHash,
      eventHash
    ]
  );

  const auditEventId = eventInsert.rows[0]?.id;

  if (!auditEventId || fieldChanges.length === 0) {
    return;
  }

  for (const field of fieldChanges) {
    await pool.query(
      `
        INSERT INTO audit_field_change (audit_event_id, field_path, old_value, new_value)
        VALUES ($1, $2, $3::jsonb, $4::jsonb)
      `,
      [auditEventId, field.fieldPath, JSON.stringify(field.oldValue), JSON.stringify(field.newValue)]
    );
  }
}

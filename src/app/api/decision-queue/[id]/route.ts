import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ALLOWED_STATUSES = new Set([
  "new",
  "reviewing",
  "approved",
  "sent_to_crm",
  "snoozed",
  "dismissed",
  "expired",
] as const);

type QueueStatus =
  | "new"
  | "reviewing"
  | "approved"
  | "sent_to_crm"
  | "snoozed"
  | "dismissed"
  | "expired";

type PatchBody = {
  action?:
    | "set_status"
    | "assign_owner"
    | "clear_owner"
    | "snooze"
    | "dismiss";
  status?: QueueStatus;
  owner?: string | null;
  snoozeUntil?: string | null;
  note?: string;
  reason?: string;
  actor?: string;
};

type QueueItemRow = {
  id: string;
  external_key: string;
  dedupe_hash: string;
  title: string;
  subtitle: string | null;
  airport: string | null;
  route: string | null;
  operator_name: string | null;
  aircraft_type: string | null;
  tail: string | null;
  status: string;
  priority: string;
  opportunity_type: string;
  service_line: string;
  estimated_value_cad: number;
  confidence: number;
  urgency: number;
  action_window: string | null;
  owner: string | null;
  recommended_action: string | null;
  suggested_channel: string | null;
  suggested_timing: string | null;
  playbook: string | null;
  source_level: string | null;
  observed_vs_inferred: string | null;
  crm_record_id: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type QueueEventRow = {
  id: string;
  queue_item_id: string;
  event_type: string;
  event_label: string;
  actor: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string | null;
};

type QueueSignalRow = {
  id: string;
  queue_item_id: string;
  signal_type: string;
  signal_source: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  observed: boolean;
  confidence: number | null;
  payload: Record<string, unknown> | null;
  occurred_at: string | null;
};

function isValidStatus(value: unknown): value is QueueStatus {
  return typeof value === "string" && ALLOWED_STATUSES.has(value as QueueStatus);
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function notFound(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 404 });
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toDateOrNull(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapQueueItem(row: QueueItemRow) {
  return {
    id: row.id,
    externalKey: row.external_key,
    dedupeHash: row.dedupe_hash,
    title: row.title,
    subtitle: row.subtitle,
    airport: row.airport,
    route: row.route,
    operatorName: row.operator_name,
    aircraftType: row.aircraft_type,
    tail: row.tail,
    status: row.status,
    priority: row.priority,
    opportunityType: row.opportunity_type,
    serviceLine: row.service_line,
    estimatedValueCad: row.estimated_value_cad,
    confidence: row.confidence,
    urgency: row.urgency,
    actionWindow: row.action_window,
    owner: row.owner,
    recommendedAction: row.recommended_action,
    suggestedChannel: row.suggested_channel,
    suggestedTiming: row.suggested_timing,
    playbook: row.playbook,
    sourceLevel: row.source_level,
    observedVsInferred: row.observed_vs_inferred,
    crmRecordId: row.crm_record_id,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQueueEvent(row: QueueEventRow) {
  return {
    id: row.id,
    queueItemId: row.queue_item_id,
    eventType: row.event_type,
    eventLabel: row.event_label,
    actor: row.actor,
    payload: row.payload ?? {},
    occurredAt: row.occurred_at,
  };
}

function mapQueueSignal(row: QueueSignalRow) {
  return {
    id: row.id,
    queueItemId: row.queue_item_id,
    signalType: row.signal_type,
    signalSource: row.signal_source,
    sourceEntityType: row.source_entity_type,
    sourceEntityId: row.source_entity_id,
    observed: row.observed,
    confidence: row.confidence,
    payload: row.payload ?? {},
    occurredAt: row.occurred_at,
  };
}

async function appendQueueEvent(params: {
  queueItemId: string;
  eventType: string;
  eventLabel: string;
  actor?: string | null;
  payload?: Record<string, unknown>;
}) {
  const { queueItemId, eventType, eventLabel, actor, payload } = params;

  await db.query(
    `
    insert into decision_queue_item_events
    (
      queue_item_id,
      event_type,
      event_label,
      actor,
      payload,
      occurred_at
    )
    values ($1, $2, $3, $4, $5::jsonb, now())
    `,
    [
      queueItemId,
      eventType,
      eventLabel,
      actor ?? null,
      JSON.stringify(payload ?? {}),
    ]
  );
}

async function getQueueItemById(id: string) {
  const itemResult = await db.query<QueueItemRow>(
    `
    select
      id,
      external_key,
      dedupe_hash,
      title,
      subtitle,
      airport,
      route,
      operator_name,
      aircraft_type,
      tail,
      status,
      priority,
      opportunity_type,
      service_line,
      estimated_value_cad,
      confidence,
      urgency,
      action_window,
      owner,
      recommended_action,
      suggested_channel,
      suggested_timing,
      playbook,
      source_level,
      observed_vs_inferred,
      crm_record_id,
      first_seen_at,
      last_seen_at,
      expires_at,
      created_at,
      updated_at
    from decision_queue_items
    where id = $1
    limit 1
    `,
    [id]
  );

  const itemRow = itemResult.rows[0];
  if (!itemRow) return null;

  const [eventsResult, signalsResult] = await Promise.all([
    db.query<QueueEventRow>(
      `
      select
        id,
        queue_item_id,
        event_type,
        event_label,
        actor,
        payload,
        occurred_at
      from decision_queue_item_events
      where queue_item_id = $1
      order by occurred_at desc
      limit 50
      `,
      [id]
    ),
    db.query<QueueSignalRow>(
      `
      select
        id,
        queue_item_id,
        signal_type,
        signal_source,
        source_entity_type,
        source_entity_id,
        observed,
        confidence,
        payload,
        occurred_at
      from decision_queue_item_signals
      where queue_item_id = $1
      order by occurred_at desc
      limit 50
      `,
      [id]
    ),
  ]);

  return {
    ...mapQueueItem(itemRow),
    events: eventsResult.rows.map(mapQueueEvent),
    signals: signalsResult.rows.map(mapQueueSignal),
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return badRequest("Missing queue item id.");
    }

    const item = await getQueueItemById(id);

    if (!item) {
      return notFound("Decision queue item not found.");
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("GET /api/decision-queue/[id] failed:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch decision queue item." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as PatchBody;

    if (!id || typeof id !== "string") {
      return badRequest("Missing queue item id.");
    }

    const existingResult = await db.query<QueueItemRow>(
      `
      select
        id,
        external_key,
        dedupe_hash,
        title,
        subtitle,
        airport,
        route,
        operator_name,
        aircraft_type,
        tail,
        status,
        priority,
        opportunity_type,
        service_line,
        estimated_value_cad,
        confidence,
        urgency,
        action_window,
        owner,
        recommended_action,
        suggested_channel,
        suggested_timing,
        playbook,
        source_level,
        observed_vs_inferred,
        crm_record_id,
        first_seen_at,
        last_seen_at,
        expires_at,
        created_at,
        updated_at
      from decision_queue_items
      where id = $1
      limit 1
      `,
      [id]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      return notFound("Decision queue item not found.");
    }

    const actor = cleanString(body.actor) ?? "system";
    const note = cleanString(body.note);
    const reason = cleanString(body.reason);
    const explicitAction = cleanString(body.action);

    if (explicitAction === "assign_owner") {
      const owner = cleanString(body.owner);
      if (!owner) {
        return badRequest("Owner is required for assign_owner.");
      }

      const updatedResult = await db.query<QueueItemRow>(
        `
        update decision_queue_items
        set owner = $2,
            updated_at = now()
        where id = $1
        returning
          id,
          external_key,
          dedupe_hash,
          title,
          subtitle,
          airport,
          route,
          operator_name,
          aircraft_type,
          tail,
          status,
          priority,
          opportunity_type,
          service_line,
          estimated_value_cad,
          confidence,
          urgency,
          action_window,
          owner,
          recommended_action,
          suggested_channel,
          suggested_timing,
          playbook,
          source_level,
          observed_vs_inferred,
          crm_record_id,
          first_seen_at,
          last_seen_at,
          expires_at,
          created_at,
          updated_at
        `,
        [id, owner]
      );

      await appendQueueEvent({
        queueItemId: id,
        eventType: "queue_item.owner_assigned",
        eventLabel: `Owner assigned to ${owner}`,
        actor,
        payload: { owner, note },
      });

      return NextResponse.json({
        ok: true,
        item: mapQueueItem(updatedResult.rows[0]),
      });
    }

    if (explicitAction === "clear_owner") {
      const updatedResult = await db.query<QueueItemRow>(
        `
        update decision_queue_items
        set owner = null,
            updated_at = now()
        where id = $1
        returning
          id,
          external_key,
          dedupe_hash,
          title,
          subtitle,
          airport,
          route,
          operator_name,
          aircraft_type,
          tail,
          status,
          priority,
          opportunity_type,
          service_line,
          estimated_value_cad,
          confidence,
          urgency,
          action_window,
          owner,
          recommended_action,
          suggested_channel,
          suggested_timing,
          playbook,
          source_level,
          observed_vs_inferred,
          crm_record_id,
          first_seen_at,
          last_seen_at,
          expires_at,
          created_at,
          updated_at
        `,
        [id]
      );

      await appendQueueEvent({
        queueItemId: id,
        eventType: "queue_item.owner_cleared",
        eventLabel: "Owner cleared",
        actor,
        payload: { note },
      });

      return NextResponse.json({
        ok: true,
        item: mapQueueItem(updatedResult.rows[0]),
      });
    }

    if (explicitAction === "snooze") {
      const snoozeUntil = toDateOrNull(body.snoozeUntil);

      const updatedResult = await db.query<QueueItemRow>(
        `
        update decision_queue_items
        set status = 'snoozed',
            expires_at = coalesce($2, expires_at),
            updated_at = now()
        where id = $1
        returning
          id,
          external_key,
          dedupe_hash,
          title,
          subtitle,
          airport,
          route,
          operator_name,
          aircraft_type,
          tail,
          status,
          priority,
          opportunity_type,
          service_line,
          estimated_value_cad,
          confidence,
          urgency,
          action_window,
          owner,
          recommended_action,
          suggested_channel,
          suggested_timing,
          playbook,
          source_level,
          observed_vs_inferred,
          crm_record_id,
          first_seen_at,
          last_seen_at,
          expires_at,
          created_at,
          updated_at
        `,
        [id, snoozeUntil]
      );

      await appendQueueEvent({
        queueItemId: id,
        eventType: "queue_item.snoozed",
        eventLabel: snoozeUntil
          ? `Item snoozed until ${snoozeUntil.toISOString()}`
          : "Item snoozed",
        actor,
        payload: {
          snoozeUntil: snoozeUntil?.toISOString() ?? null,
          note,
        },
      });

      return NextResponse.json({
        ok: true,
        item: mapQueueItem(updatedResult.rows[0]),
      });
    }

    if (explicitAction === "dismiss") {
      const updatedResult = await db.query<QueueItemRow>(
        `
        update decision_queue_items
        set status = 'dismissed',
            updated_at = now()
        where id = $1
        returning
          id,
          external_key,
          dedupe_hash,
          title,
          subtitle,
          airport,
          route,
          operator_name,
          aircraft_type,
          tail,
          status,
          priority,
          opportunity_type,
          service_line,
          estimated_value_cad,
          confidence,
          urgency,
          action_window,
          owner,
          recommended_action,
          suggested_channel,
          suggested_timing,
          playbook,
          source_level,
          observed_vs_inferred,
          crm_record_id,
          first_seen_at,
          last_seen_at,
          expires_at,
          created_at,
          updated_at
        `,
        [id]
      );

      await appendQueueEvent({
        queueItemId: id,
        eventType: "queue_item.dismissed",
        eventLabel: reason ? `Item dismissed: ${reason}` : "Item dismissed",
        actor,
        payload: { reason, note },
      });

      return NextResponse.json({
        ok: true,
        item: mapQueueItem(updatedResult.rows[0]),
      });
    }

    if (explicitAction === "set_status") {
      if (!isValidStatus(body.status)) {
        return badRequest("A valid status is required for set_status.");
      }

      const updatedResult = await db.query<QueueItemRow>(
        `
        update decision_queue_items
        set status = $2,
            updated_at = now()
        where id = $1
        returning
          id,
          external_key,
          dedupe_hash,
          title,
          subtitle,
          airport,
          route,
          operator_name,
          aircraft_type,
          tail,
          status,
          priority,
          opportunity_type,
          service_line,
          estimated_value_cad,
          confidence,
          urgency,
          action_window,
          owner,
          recommended_action,
          suggested_channel,
          suggested_timing,
          playbook,
          source_level,
          observed_vs_inferred,
          crm_record_id,
          first_seen_at,
          last_seen_at,
          expires_at,
          created_at,
          updated_at
        `,
        [id, body.status]
      );

      await appendQueueEvent({
        queueItemId: id,
        eventType: "queue_item.status_changed",
        eventLabel: `Status changed to ${body.status}`,
        actor,
        payload: {
          status: body.status,
          note,
        },
      });

      return NextResponse.json({
        ok: true,
        item: mapQueueItem(updatedResult.rows[0]),
      });
    }

    const updates: string[] = [];
    const values: unknown[] = [id];
    let paramIndex = 2;

    const eventPayload: Record<string, unknown> = {};
    const eventLabels: string[] = [];

    if (body.status !== undefined) {
      if (!isValidStatus(body.status)) {
        return badRequest("Invalid status.");
      }
      updates.push(`status = $${paramIndex++}`);
      values.push(body.status);
      eventPayload.status = body.status;
      eventLabels.push(`status → ${body.status}`);
    }

    if (body.owner !== undefined) {
      const owner = cleanString(body.owner);
      updates.push(`owner = $${paramIndex++}`);
      values.push(owner);
      eventPayload.owner = owner;
      eventLabels.push(owner ? `owner → ${owner}` : "owner cleared");
    }

    if (
      body.status === "snoozed" ||
      explicitAction === "snooze" ||
      body.snoozeUntil !== undefined
    ) {
      const snoozeUntil = toDateOrNull(body.snoozeUntil);

      if (body.snoozeUntil !== undefined && body.snoozeUntil !== null && !snoozeUntil) {
        return badRequest("Invalid snoozeUntil date.");
      }

      if (snoozeUntil) {
        updates.push(`expires_at = $${paramIndex++}`);
        values.push(snoozeUntil);
        eventPayload.snoozeUntil = snoozeUntil.toISOString();
        eventLabels.push(`snoozed until ${snoozeUntil.toISOString()}`);
      } else if (body.status === "snoozed") {
        eventLabels.push("snoozed");
      }
    }

    if (body.status === "dismissed" && reason) {
      eventPayload.reason = reason;
      eventLabels.push(`reason: ${reason}`);
    }

    if (note) {
      eventPayload.note = note;
    }

    if (updates.length === 0) {
      return badRequest(
        "No valid fields provided. Send action, status, owner, or snoozeUntil."
      );
    }

    updates.push("updated_at = now()");

    const updatedResult = await db.query<QueueItemRow>(
      `
      update decision_queue_items
      set ${updates.join(", ")}
      where id = $1
      returning
        id,
        external_key,
        dedupe_hash,
        title,
        subtitle,
        airport,
        route,
        operator_name,
        aircraft_type,
        tail,
        status,
        priority,
        opportunity_type,
        service_line,
        estimated_value_cad,
        confidence,
        urgency,
        action_window,
        owner,
        recommended_action,
        suggested_channel,
        suggested_timing,
        playbook,
        source_level,
        observed_vs_inferred,
        crm_record_id,
        first_seen_at,
        last_seen_at,
        expires_at,
        created_at,
        updated_at
      `,
      values
    );

    await appendQueueEvent({
      queueItemId: id,
      eventType: "queue_item.updated",
      eventLabel:
        eventLabels.length > 0
          ? `Queue item updated: ${eventLabels.join(" • ")}`
          : "Queue item updated",
      actor,
      payload: eventPayload,
    });

    return NextResponse.json({
      ok: true,
      item: mapQueueItem(updatedResult.rows[0]),
    });
  } catch (error) {
    console.error("PATCH /api/decision-queue/[id] failed:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update decision queue item." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const existingResult = await db.query<{ id: string }>(
      `
      select id
      from decision_queue_items
      where id = $1
      limit 1
      `,
      [id]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      return notFound("Decision queue item not found.");
    }

    await db.query(
      `
      delete from decision_queue_items
      where id = $1
      `,
      [id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/decision-queue/[id] failed:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete decision queue item." },
      { status: 500 }
    );
  }
}
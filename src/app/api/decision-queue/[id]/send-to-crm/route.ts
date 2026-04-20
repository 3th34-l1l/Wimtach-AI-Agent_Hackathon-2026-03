import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDecisionQueueItemToCrm } from "@/lib/decision-queue/crm-sync";

type Body = {
  actor?: string;
  note?: string;
};

type ExistingRow = {
  id: string;
  crm_record_id: string | null;
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

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function notFound(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 404 });
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
      limit 20
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
      limit 20
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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;

    if (!id || typeof id !== "string") {
      return badRequest("Missing queue item id.");
    }

    const existingResult = await db.query<ExistingRow>(
      `
      select id, crm_record_id
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

    if (existing.crm_record_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Decision queue item has already been sent to CRM.",
          crmRecordId: existing.crm_record_id,
        },
        { status: 409 }
      );
    }

    const result = await sendDecisionQueueItemToCrm({
      queueItemId: id,
      actor: body.actor ?? "decision-queue-ui",
      note: body.note ?? null,
    });

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "ALREADY_SENT"
            ? 409
            : result.code === "INVALID_STATUS"
              ? 400
              : 500;

      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          code: result.code,
        },
        { status }
      );
    }

    const updated = await getQueueItemById(id);

    return NextResponse.json({
      ok: true,
      crmRecordId: result.crmRecordId,
      item: updated,
    });
  } catch (error) {
    console.error("POST /api/decision-queue/[id]/send-to-crm failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send decision queue item to CRM.",
      },
      { status: 500 }
    );
  }
}
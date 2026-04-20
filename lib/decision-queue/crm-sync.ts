import { adminDb as db } from "@/lib/db-admin";

export type SendToCrmParams = {
  queueItemId: string;
  actor?: string | null;
  note?: string | null;
};

export type CrmSyncSuccess = {
  ok: true;
  crmRecordId: string;
  itemId: string;
};

export type CrmSyncFailure = {
  ok: false;
  error: string;
  code:
    | "NOT_FOUND"
    | "ALREADY_SENT"
    | "INVALID_STATUS"
    | "CRM_CREATE_FAILED"
    | "DB_UPDATE_FAILED"
    | "UNKNOWN";
};

export type CrmSyncResult = CrmSyncSuccess | CrmSyncFailure;

type QueueItemRow = {
  id: string;
  title: string;
  subtitle: string | null;
  airport: string | null;
  route: string | null;
  operator_name: string | null;
  aircraft_type: string | null;
  tail: string | null;
  priority: string;
  opportunity_type: string;
  service_line: string;
  estimated_value_cad: number | null;
  confidence: number | null;
  urgency: number | null;
  action_window: string | null;
  recommended_action: string | null;
  suggested_channel: string | null;
  suggested_timing: string | null;
  playbook: string | null;
  source_level: string | null;
  observed_vs_inferred: string | null;
  owner: string | null;
  crm_record_id: string | null;
  status: string;
};

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

async function appendQueueEventSafe(params: {
  queueItemId: string;
  eventType: string;
  eventLabel: string;
  actor?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
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
        params.queueItemId,
        params.eventType,
        params.eventLabel,
        params.actor ?? null,
        JSON.stringify(params.payload ?? {}),
      ]
    );
  } catch (error) {
    console.error("appendQueueEventSafe failed:", error);
  }
}

function buildCrmPayload(item: QueueItemRow) {
  return {
    externalSource: "decision_queue",
    externalId: item.id,
    name: item.title,
    subtitle: item.subtitle,
    airport: item.airport,
    route: item.route,
    operatorName: item.operator_name,
    aircraftType: item.aircraft_type,
    tail: item.tail,
    priority: item.priority,
    opportunityType: item.opportunity_type,
    serviceLine: item.service_line,
    estimatedValueCad: item.estimated_value_cad ?? 0,
    confidence: item.confidence ?? 0,
    urgency: item.urgency ?? 0,
    actionWindow: item.action_window,
    recommendedAction: item.recommended_action,
    suggestedChannel: item.suggested_channel,
    suggestedTiming: item.suggested_timing,
    playbook: item.playbook,
    sourceLevel: item.source_level,
    observedVsInferred: item.observed_vs_inferred,
    owner: item.owner,
  };
}

async function createCrmOpportunity(payload: Record<string, unknown>) {
  try {
    const externalId = String(payload.externalId ?? "");
    if (!externalId) {
      throw new Error("Missing externalId for CRM payload.");
    }

    const crmRecordId = `crm_${externalId}`;

    return {
      ok: true as const,
      crmRecordId,
      raw: {
        accepted: true,
        provider: "internal-placeholder-adapter",
        payload,
      },
    };
  } catch (error) {
    console.error("createCrmOpportunity failed:", error);
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "Unknown CRM adapter failure.",
    };
  }
}

export async function sendDecisionQueueItemToCrm(
  params: SendToCrmParams
): Promise<CrmSyncResult> {
  const actor = clean(params.actor) ?? "system";
  const note = clean(params.note);

  try {
    const result = await db.query<QueueItemRow>(
      `
      select
        id,
        title,
        subtitle,
        airport,
        route,
        operator_name,
        aircraft_type,
        tail,
        priority,
        opportunity_type,
        service_line,
        estimated_value_cad,
        confidence,
        urgency,
        action_window,
        recommended_action,
        suggested_channel,
        suggested_timing,
        playbook,
        source_level,
        observed_vs_inferred,
        owner,
        crm_record_id,
        status
      from decision_queue_items
      where id = $1
      limit 1
      `,
      [params.queueItemId]
    );

    const item = result.rows[0];

    if (!item) {
      return { ok: false, code: "NOT_FOUND", error: "Decision queue item not found." };
    }

    if (item.crm_record_id) {
      return {
        ok: false,
        code: "ALREADY_SENT",
        error: "Decision queue item already has a CRM record.",
      };
    }

    if (item.status === "dismissed" || item.status === "expired") {
      return {
        ok: false,
        code: "INVALID_STATUS",
        error: `Items with status "${item.status}" cannot be sent to CRM.`,
      };
    }

    const crmPayload = buildCrmPayload(item);

    await appendQueueEventSafe({
      queueItemId: item.id,
      eventType: "queue_item.crm_send_started",
      eventLabel: "CRM handoff started",
      actor,
      payload: { note, crmPayload },
    });

    const crmResult = await createCrmOpportunity(crmPayload);

    if (!crmResult.ok) {
      await appendQueueEventSafe({
        queueItemId: item.id,
        eventType: "queue_item.crm_send_failed",
        eventLabel: "CRM handoff failed",
        actor,
        payload: { note, error: crmResult.error },
      });

      return {
        ok: false,
        code: "CRM_CREATE_FAILED",
        error: crmResult.error,
      };
    }

    try {
      await db.query(
        `
        update decision_queue_items
        set crm_record_id = $2,
            status = 'sent_to_crm',
            updated_at = now()
        where id = $1
        `,
        [item.id, crmResult.crmRecordId]
      );

      await appendQueueEventSafe({
        queueItemId: item.id,
        eventType: "queue_item.sent_to_crm",
        eventLabel: `Sent to CRM as ${crmResult.crmRecordId}`,
        actor,
        payload: {
          crmRecordId: crmResult.crmRecordId,
          note,
          providerResponse: crmResult.raw,
        },
      });

      return {
        ok: true,
        crmRecordId: crmResult.crmRecordId,
        itemId: item.id,
      };
    } catch (error) {
      console.error("decisionQueueItems update after CRM send failed:", error);

      await appendQueueEventSafe({
        queueItemId: item.id,
        eventType: "queue_item.crm_sync_db_update_failed",
        eventLabel: "CRM created but queue update failed",
        actor,
        payload: {
          crmRecordId: crmResult.crmRecordId,
          note,
          error: error instanceof Error ? error.message : "Unknown DB update failure",
        },
      });

      return {
        ok: false,
        code: "DB_UPDATE_FAILED",
        error: "CRM record was created, but queue item update failed.",
      };
    }
  } catch (error) {
    console.error("sendDecisionQueueItemToCrm failed:", error);

    return {
      ok: false,
      code: "UNKNOWN",
      error: error instanceof Error ? error.message : "Unknown CRM sync failure.",
    };
  }
}
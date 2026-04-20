import { adminDb as db } from "@/lib/db-admin";
import type { LeadSignal } from "./contracts";
import { buildDecisionQueueFingerprint } from "./dedupe";
import { scoreLeadSignal } from "./scoring";
import { checkDecisionQueueSuppression } from "./suppression";

export type IngestLeadSignalResult =
  | {
      ok: true;
      suppressed: false;
      created: boolean;
      updated: boolean;
      item: Record<string, unknown>;
    }
  | {
      ok: true;
      suppressed: true;
      created: false;
      updated: false;
      reason: string | null;
      existingItemId: string | null;
    }
  | {
      ok: false;
      suppressed: false;
      created: false;
      updated: false;
      error: string;
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
  recommended_action: string | null;
  suggested_channel: string | null;
  suggested_timing: string | null;
  playbook: string | null;
  source_level: string | null;
  observed_vs_inferred: string | null;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
};

async function appendQueueEventSafe(params: {
  queueItemId: string;
  eventType: string;
  eventLabel: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await db.query(
      `
      insert into decision_queue_item_events
      (
        queue_item_id,
        event_label,
        event_type,
        payload,
        occurred_at
      )
      values ($1, $2, $3, $4::jsonb, now())
      `,
      [
        params.queueItemId,
        params.eventLabel,
        params.eventType,
        JSON.stringify(params.payload ?? {}),
      ]
    );
  } catch (error) {
    console.error("appendQueueEventSafe failed:", error);
  }
}

async function appendQueueSignalSafe(params: {
  queueItemId: string;
  signalType: string;
  signalSource: string;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  observed: boolean;
  confidence: number;
  payload: Record<string, unknown>;
  occurredAt: Date;
}) {
  try {
    await db.query(
      `
      insert into decision_queue_item_signals
      (
        queue_item_id,
        signal_type,
        signal_source,
        source_entity_type,
        source_entity_id,
        observed,
        confidence,
        payload,
        occurred_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      `,
      [
        params.queueItemId,
        params.signalType,
        params.signalSource,
        params.sourceEntityType ?? null,
        params.sourceEntityId ?? null,
        params.observed,
        params.confidence,
        JSON.stringify(params.payload),
        params.occurredAt,
      ]
    );
  } catch (error) {
    console.error("appendQueueSignalSafe failed:", error);
  }
}

function rowToItem(row: QueueItemRow): Record<string, unknown> {
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
    recommendedAction: row.recommended_action,
    suggestedChannel: row.suggested_channel,
    suggestedTiming: row.suggested_timing,
    playbook: row.playbook,
    sourceLevel: row.source_level,
    observedVsInferred: row.observed_vs_inferred,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    updatedAt: row.updated_at,
  };
}

export async function ingestLeadSignal(
  signal: LeadSignal
): Promise<IngestLeadSignalResult> {
  try {
    const dedupeHash = buildDecisionQueueFingerprint(signal);
    const scored = scoreLeadSignal(signal);

    const title = buildTitle(signal);
    const subtitle = buildSubtitle(signal);

    const suppression = await checkDecisionQueueSuppression({
      dedupeHash,
      operatorName: signal.aircraft?.operator ?? null,
      tail: signal.aircraft?.tail ?? null,
    });

    if (suppression.suppressed) {
      return {
        ok: true,
        suppressed: true,
        created: false,
        updated: false,
        reason: suppression.reason,
        existingItemId: suppression.existingItemId,
      };
    }

    const existingResult = await db.query<QueueItemRow>(
      `
      select *
      from decision_queue_items
      where dedupe_hash = $1
      order by updated_at desc
      limit 1
      `,
      [dedupeHash]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      const createdResult = await db.query<QueueItemRow>(
        `
        insert into decision_queue_items
        (
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
          recommended_action,
          suggested_channel,
          suggested_timing,
          playbook,
          source_level,
          observed_vs_inferred,
          first_seen_at,
          last_seen_at,
          created_at,
          updated_at
        )
        values
        (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          'new', $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $23, now(), now()
        )
        returning *
        `,
        [
          signal.eventId,
          dedupeHash,
          title,
          subtitle,
          signal.airport?.icao ?? null,
          signal.route?.from && signal.route?.to
            ? `${signal.route.from} → ${signal.route.to}`
            : null,
          signal.aircraft?.operator ?? null,
          signal.aircraft?.aircraftType ?? null,
          signal.aircraft?.tail ?? null,
          scored.priority,
          signal.serviceFit?.opportunityType ?? "concierge",
          signal.serviceFit?.serviceLine ?? "Nous Aviation",
          scored.estimatedValueCad,
          scored.confidence,
          scored.urgency,
          signal.serviceFit?.actionWindow ?? null,
          buildRecommendedAction(signal),
          buildSuggestedChannel(signal),
          buildSuggestedTiming(signal),
          buildPlaybook(signal),
          signal.provenance.sourceLevel,
          signal.provenance.explanation,
          new Date(signal.occurredAt),
        ]
      );

      const created = createdResult.rows[0];

      await appendQueueSignalSafe({
        queueItemId: created.id,
        signalType: signal.eventType,
        signalSource: signal.producer,
        sourceEntityType: signal.entity.entityType,
        sourceEntityId: signal.entity.entityId,
        observed: signal.provenance.sourceLevel !== "Inferred",
        confidence: scored.confidence,
        payload: signal.raw,
        occurredAt: new Date(signal.occurredAt),
      });

      await appendQueueEventSafe({
        queueItemId: created.id,
        eventType: "queue_item.created",
        eventLabel: "Recommendation published",
        payload: signal.raw,
      });

      return {
        ok: true,
        suppressed: false,
        created: true,
        updated: false,
        item: rowToItem(created),
      };
    }

    const updatedResult = await db.query<QueueItemRow>(
      `
      update decision_queue_items
      set
        last_seen_at = $2,
        estimated_value_cad = greatest(coalesce(estimated_value_cad, 0), $3),
        confidence = greatest(coalesce(confidence, 0), $4),
        urgency = greatest(coalesce(urgency, 0), $5),
        priority = $6,
        observed_vs_inferred = $7,
        source_level = $8,
        updated_at = now()
      where id = $1
      returning *
      `,
      [
        existing.id,
        new Date(signal.occurredAt),
        scored.estimatedValueCad,
        scored.confidence,
        scored.urgency,
        higherPriority(existing.priority, scored.priority),
        signal.provenance.explanation,
        mergeSourceLevel(existing.source_level, signal.provenance.sourceLevel),
      ]
    );

    const updated = updatedResult.rows[0];

    await appendQueueSignalSafe({
      queueItemId: updated.id,
      signalType: signal.eventType,
      signalSource: signal.producer,
      sourceEntityType: signal.entity.entityType,
      sourceEntityId: signal.entity.entityId,
      observed: signal.provenance.sourceLevel !== "Inferred",
      confidence: scored.confidence,
      payload: signal.raw,
      occurredAt: new Date(signal.occurredAt),
    });

    await appendQueueEventSafe({
      queueItemId: updated.id,
      eventType: "queue_item.updated_from_signal",
      eventLabel: "Recommendation refreshed from new signal",
      payload: signal.raw,
    });

    return {
      ok: true,
      suppressed: false,
      created: false,
      updated: true,
      item: rowToItem(updated),
    };
  } catch (error) {
    console.error("ingestLeadSignal failed:", error);

    return {
      ok: false,
      suppressed: false,
      created: false,
      updated: false,
      error:
        error instanceof Error ? error.message : "Failed to ingest lead signal.",
    };
  }
}

function higherPriority(a: string, b: string) {
  const rank = { low: 1, medium: 2, high: 3 };
  return rank[b as keyof typeof rank] > rank[a as keyof typeof rank] ? b : a;
}

function mergeSourceLevel(a: string | null | undefined, b: string | null | undefined) {
  if (a === b) return a ?? "Mixed";
  if (a === "Mixed" || b === "Mixed") return "Mixed";
  return "Mixed";
}

function buildTitle(signal: LeadSignal) {
  if (signal.serviceFit?.opportunityType === "detailing" && signal.airport?.icao) {
    return `Offer detailing during dwell at ${signal.airport.icao}`;
  }

  if (
    signal.serviceFit?.opportunityType === "charter_sales" &&
    signal.route?.from &&
    signal.route?.to
  ) {
    return `Pitch charter offer for ${signal.route.from} → ${signal.route.to}`;
  }

  if (
    signal.serviceFit?.opportunityType === "operator_partnership" &&
    signal.airport?.icao
  ) {
    return `Open partnership conversation at ${signal.airport.icao}`;
  }

  return "Review certified lead opportunity";
}

function buildSubtitle(signal: LeadSignal) {
  return [
    signal.aircraft?.tail,
    signal.aircraft?.aircraftType,
    signal.aircraft?.operator,
    signal.airport?.icao,
  ]
    .filter(Boolean)
    .join(" • ");
}

function buildRecommendedAction(signal: LeadSignal) {
  switch (signal.serviceFit?.opportunityType) {
    case "detailing":
      return "Contact airport/FBO path and position detailing offer";
    case "charter_sales":
      return "Add to charter outreach with route-specific pitch";
    case "operator_partnership":
      return "Open operator or airport partnership conversation";
    case "multi_service":
      return "Route for multi-service qualification review";
    default:
      return "Review and route to the right owner";
  }
}

function buildSuggestedChannel(signal: LeadSignal) {
  if (signal.provenance.signalTypes.includes("contact_verified")) {
    return "Email + call";
  }

  if (signal.provenance.signalTypes.includes("warm_intro")) {
    return "Warm intro";
  }

  return "Research + outreach";
}

function buildSuggestedTiming(signal: LeadSignal) {
  return signal.serviceFit?.actionWindow ?? "Today";
}

function buildPlaybook(signal: LeadSignal) {
  switch (signal.serviceFit?.opportunityType) {
    case "detailing":
      return "Overnight detailing package";
    case "charter_sales":
      return "Luxury charter corridor playbook";
    case "operator_partnership":
      return "Airport/operator relationship playbook";
    case "multi_service":
      return "Multi-service account expansion";
    default:
      return "Standard lead qualification";
  }
}
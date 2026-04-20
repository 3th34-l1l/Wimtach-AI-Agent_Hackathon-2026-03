import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/*
========================================================
TYPES
========================================================
*/

type QueueStatus =
  | "new"
  | "reviewing"
  | "approved"
  | "sent_to_crm"
  | "snoozed"
  | "dismissed"
  | "expired";

type Priority = "high" | "medium" | "low";

type OpportunityType =
  | "detailing"
  | "charter_sales"
  | "operator_partnership"
  | "concierge"
  | "multi_service";

type ServiceLine = "Nous Aviation" | "Nous Systems Group" | "Both";

/*
========================================================
VALIDATION
========================================================
*/

const VALID_STATUSES = new Set<QueueStatus>([
  "new",
  "reviewing",
  "approved",
  "sent_to_crm",
  "snoozed",
  "dismissed",
  "expired",
]);

const VALID_PRIORITIES = new Set<Priority>(["high", "medium", "low"]);

const VALID_OPPORTUNITY_TYPES = new Set<OpportunityType>([
  "detailing",
  "charter_sales",
  "operator_partnership",
  "concierge",
  "multi_service",
]);

const VALID_SERVICE_LINES = new Set<ServiceLine>([
  "Nous Aviation",
  "Nous Systems Group",
  "Both",
]);

/*
========================================================
UTILS
========================================================
*/

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

function cleanNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && !Number.isNaN(value)
    ? value
    : fallback;
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/*
========================================================
GET (SQL VERSION)
========================================================
*/

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const search = cleanString(searchParams.get("search"));
    const status = cleanString(searchParams.get("status"));
    const priority = cleanString(searchParams.get("priority"));
    const includeKpis = searchParams.get("includeKpis") === "true";

    const values: any[] = [];
    let idx = 1;

    let where = `where 1=1`;

    if (status && status !== "all") {
      if (!VALID_STATUSES.has(status as QueueStatus)) {
        return badRequest("Invalid status");
      }
      where += ` and status = $${idx++}`;
      values.push(status);
    }

    if (priority && priority !== "all") {
      if (!VALID_PRIORITIES.has(priority as Priority)) {
        return badRequest("Invalid priority");
      }
      where += ` and priority = $${idx++}`;
      values.push(priority);
    }

    if (search) {
      where += `
        and (
          title ilike $${idx}
          or airport ilike $${idx}
          or operator_name ilike $${idx}
          or aircraft_type ilike $${idx}
          or tail ilike $${idx}
        )
      `;
      values.push(`%${search}%`);
      idx++;
    }

    const result = await db.query(
      `
      select *
      from decision_queue_items
      ${where}
      order by
        case priority
          when 'high' then 3
          when 'medium' then 2
          else 1
        end desc,
        urgency desc,
        confidence desc,
        estimated_value_cad desc,
        last_seen_at desc
      limit 200
      `,
      values
    );

    const items = result.rows;

    if (!includeKpis) {
      return NextResponse.json({ ok: true, items });
    }

    const open = items.filter((x) =>
      ["new", "reviewing", "approved"].includes(x.status)
    );

    const kpis = {
      openActions: open.length,
      highPriority: open.filter((x) => x.priority === "high").length,
      expiringSoon: open.filter((x) => x.urgency >= 75).length,
      estimatedPipelineValue: open.reduce(
        (s, x) => s + (x.estimated_value_cad ?? 0),
        0
      ),
      sentToCrmToday: items.filter((x) => x.status === "sent_to_crm").length,
      actionedToday: items.filter((x) =>
        ["reviewing", "approved", "sent_to_crm"].includes(x.status)
      ).length,
    };

    return NextResponse.json({
      ok: true,
      items,
      kpis,
    });
  } catch (err) {
    console.error("GET decision-queue failed", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch queue" },
      { status: 500 }
    );
  }
}

/*
========================================================
POST (SQL VERSION)
========================================================
*/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const title = cleanString(body.title);
    if (!title) return badRequest("Title required");

    if (!VALID_PRIORITIES.has(body.priority)) {
      return badRequest("Invalid priority");
    }

    if (!VALID_OPPORTUNITY_TYPES.has(body.opportunityType)) {
      return badRequest("Invalid opportunityType");
    }

    if (!VALID_SERVICE_LINES.has(body.serviceLine)) {
      return badRequest("Invalid serviceLine");
    }

    const id = crypto.randomUUID();

    const result = await db.query(
      `
      insert into decision_queue_items (
        id,
        external_key,
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
        dedupe_hash,
        first_seen_at,
        last_seen_at,
        expires_at,
        created_at,
        updated_at
      )
      values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
        $25, now(), now(), $26, now(), now()
      )
      returning *
      `,
      [
        id,
        cleanString(body.externalKey) ?? crypto.randomUUID(),
        title,
        cleanString(body.subtitle),
        cleanString(body.airport),
        cleanString(body.route),
        cleanString(body.operatorName),
        cleanString(body.aircraftType),
        cleanString(body.tail),
        VALID_STATUSES.has(body.status) ? body.status : "new",
        body.priority,
        body.opportunityType,
        body.serviceLine,
        Math.max(0, cleanNumber(body.estimatedValueCad)),
        clampInt(cleanNumber(body.confidence), 0, 100),
        clampInt(cleanNumber(body.urgency), 0, 100),
        cleanString(body.actionWindow),
        cleanString(body.owner),
        cleanString(body.recommendedAction),
        cleanString(body.suggestedChannel),
        cleanString(body.suggestedTiming),
        cleanString(body.playbook),
        body.sourceLevel ?? "Mixed",
        cleanString(body.observedVsInferred),
        cleanString(body.dedupeHash) ?? crypto.randomUUID(),
        parseDate(body.expiresAt),
      ]
    );

    // event insert
    await db.query(
      `
      insert into decision_queue_item_events (
        queue_item_id,
        event_type,
        event_label,
        actor,
        payload,
        occurred_at
      )
      values ($1,$2,$3,$4,$5::jsonb, now())
      `,
      [
        id,
        "queue_item.created",
        "Queue item created",
        cleanString(body.actor) ?? "system",
        JSON.stringify({
          whySurfaced: body.whySurfaced ?? [],
          signalTypes: body.signalTypes ?? [],
        }),
      ]
    );

    return NextResponse.json(
      { ok: true, item: result.rows[0] },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST decision-queue failed", err);
    return NextResponse.json(
      { ok: false, error: "Failed to create item" },
      { status: 500 }
    );
  }
}
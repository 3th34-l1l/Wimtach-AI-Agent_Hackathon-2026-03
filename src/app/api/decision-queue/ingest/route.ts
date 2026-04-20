import { NextRequest, NextResponse } from "next/server";
import { ingestLeadSignal } from "@/lib/decision-queue/ingest";
import type { LeadSignal } from "@/lib/decision-queue/contracts";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLeadSignal(value: unknown): value is LeadSignal {
  if (!isObject(value)) return false;

  return (
    typeof value.eventId === "string" &&
    typeof value.eventType === "string" &&
    typeof value.occurredAt === "string" &&
    typeof value.producer === "string" &&
    isObject(value.entity) &&
    typeof value.entity.entityType === "string" &&
    typeof value.entity.entityId === "string" &&
    isObject(value.provenance) &&
    typeof value.provenance.sourceLevel === "string" &&
    typeof value.provenance.explanation === "string" &&
    Array.isArray(value.provenance.signalTypes) &&
    isObject(value.raw)
  );
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch (error) {
      console.error("POST /api/decision-queue/ingest invalid JSON:", error);
      return badRequest("Request body must be valid JSON.");
    }

    if (!isLeadSignal(body)) {
      return badRequest(
        "Request body is not a valid LeadSignal. Required fields: eventId, eventType, occurredAt, producer, entity, provenance, raw."
      );
    }

    const result = await ingestLeadSignal(body);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          suppressed: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    if (result.suppressed) {
      return NextResponse.json(
        {
          ok: true,
          suppressed: true,
          created: false,
          updated: false,
          reason: result.reason,
          existingItemId: result.existingItemId,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        suppressed: false,
        created: result.created,
        updated: result.updated,
        item: result.item,
      },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    console.error("POST /api/decision-queue/ingest failed:", error);

    return NextResponse.json(
      {
        ok: false,
        suppressed: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to ingest lead signal.",
      },
      { status: 500 }
    );
  }
}
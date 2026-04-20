import { adminDb as db } from "@/lib/db-admin";

export type SuppressionCheckInput = {
  dedupeHash?: string | null;
  operatorName?: string | null;
  tail?: string | null;
};

export type SuppressionResult = {
  suppressed: boolean;
  reason: string | null;
  existingItemId: string | null;
};

type QueueItemRow = {
  id: string;
  status: string;
  expires_at: string | null;
  updated_at: string;
};

export async function checkDecisionQueueSuppression(
  input: SuppressionCheckInput
): Promise<SuppressionResult> {
  try {
    if (!input.dedupeHash) {
      return { suppressed: false, reason: null, existingItemId: null };
    }

    const active = await db.query<QueueItemRow>(
      `
      select id, status, expires_at, updated_at
      from decision_queue_items
      where dedupe_hash = $1
        and status = any($2::text[])
      order by updated_at desc
      limit 1
      `,
      [
        input.dedupeHash,
        ["new", "reviewing", "approved", "sent_to_crm", "snoozed"],
      ]
    );

    const existing = active.rows[0];
    const now = Date.now();

    if (existing) {
      if (existing.status === "sent_to_crm") {
        return {
          suppressed: true,
          reason: "An item with this fingerprint has already been sent to CRM.",
          existingItemId: existing.id,
        };
      }

      if (
        existing.status === "snoozed" &&
        existing.expires_at &&
        new Date(existing.expires_at).getTime() > now
      ) {
        return {
          suppressed: true,
          reason: "An item with this fingerprint is currently snoozed.",
          existingItemId: existing.id,
        };
      }

      if (["new", "reviewing", "approved"].includes(existing.status)) {
        return {
          suppressed: true,
          reason: "An active queue item with this fingerprint already exists.",
          existingItemId: existing.id,
        };
      }
    }

    const dismissed = await db.query<QueueItemRow>(
      `
      select id, status, expires_at, updated_at
      from decision_queue_items
      where dedupe_hash = $1
        and status = 'dismissed'
        and updated_at >= now() - interval '14 days'
      order by updated_at desc
      limit 1
      `,
      [input.dedupeHash]
    );

    const dismissedRow = dismissed.rows[0];
    if (dismissedRow) {
      return {
        suppressed: true,
        reason: "A matching item was dismissed in the last 14 days.",
        existingItemId: dismissedRow.id,
      };
    }

    return {
      suppressed: false,
      reason: null,
      existingItemId: null,
    };
  } catch (error) {
    console.error("checkDecisionQueueSuppression failed:", error);
    return {
      suppressed: false,
      reason: null,
      existingItemId: null,
    };
  }
}
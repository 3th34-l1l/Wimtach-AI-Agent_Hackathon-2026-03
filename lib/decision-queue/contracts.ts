// FILE: lib/decision-queue/contracts.ts

export type QueueStatus =
  | "new"
  | "reviewing"
  | "approved"
  | "sent_to_crm"
  | "snoozed"
  | "dismissed"
  | "expired";

export type Priority = "high" | "medium" | "low";

export type OpportunityType =
  | "detailing"
  | "charter_sales"
  | "operator_partnership"
  | "concierge"
  | "multi_service";

export type ServiceLine = "Nous Aviation" | "Nous Systems Group" | "Both";

export type SourceLevel = "Observed" | "Inferred" | "Mixed";

export type LeadSignalType =
  | "flight.observed"
  | "aircraft.on_ground"
  | "operator.fit_detected"
  | "airport.traffic_cluster_detected"
  | "lead.contact_enriched"
  | "opportunity.service_fit_detected"
  | "crm.opportunity_created"
  | "crm.opportunity_rejected"
  | "outreach.sent"
  | "outreach.replied"
  | "llm.gap_filled";

export type LeadSignal = {
  eventId: string;
  eventType: LeadSignalType | string;
  occurredAt: string;
  producer: string;
  entity: {
    entityType:
      | "aircraft"
      | "operator"
      | "airport"
      | "route"
      | "contact"
      | "opportunity"
      | string;
    entityId: string;
  };
  aircraft?: {
    tail?: string;
    aircraftType?: string;
    operator?: string;
  };
  airport?: {
    icao?: string;
  };
  route?: {
    from?: string;
    to?: string;
  };
  serviceFit?: {
    opportunityType?: OpportunityType;
    serviceLine?: ServiceLine;
    estimatedValueCad?: number;
    confidence?: number;
    urgency?: number;
    actionWindow?: string;
  };
  provenance: {
    sourceLevel: SourceLevel;
    explanation: string;
    signalTypes: string[];
  };
  notes?: string[];
  raw: Record<string, unknown>;
};

export type DecisionQueueItemApi = {
  id: string;
  externalKey: string;
  dedupeHash: string;
  title: string;
  subtitle: string | null;
  airport: string | null;
  route: string | null;
  operatorName: string | null;
  aircraftType: string | null;
  tail: string | null;
  status: QueueStatus | string;
  priority: Priority | string;
  opportunityType: OpportunityType | string;
  serviceLine: ServiceLine | string;
  estimatedValueCad: number;
  confidence: number;
  urgency: number;
  actionWindow: string | null;
  owner: string | null;
  recommendedAction: string | null;
  suggestedChannel: string | null;
  suggestedTiming: string | null;
  playbook: string | null;
  sourceLevel: SourceLevel | string | null;
  observedVsInferred: string | null;
  crmRecordId: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DecisionQueueEventApi = {
  id: string;
  queueItemId: string;
  eventType: string;
  eventLabel: string;
  actor: string | null;
  payload: Record<string, unknown>;
  occurredAt: string | null;
};

export type DecisionQueueSignalApi = {
  id: string;
  queueItemId: string;
  signalType: string;
  signalSource: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  observed: boolean;
  confidence: number | null;
  payload: Record<string, unknown>;
  occurredAt: string | null;
};
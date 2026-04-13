export type OpportunityType =
  | "detailing"
  | "maintenance"
  | "charter"
  | "concierge"
  | "villa"
  | "exotic_rental"
  | "yacht";

export type OpportunityPriority = "low" | "medium" | "high";

export type OpportunitySignal = {
  type: OpportunityType;
  score: number;
  priority: OpportunityPriority;
  rationale: string;
};

export type OpportunityRecord = {
  aircraftType?: string;
  dwellTime?: string;
  passengerProfile?: string;
  operatorType?: string;
  confidence?: string;
};

export type OpportunityValues = Record<string, string | undefined>;

function normalizeText(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function boost(value?: string): number {
  switch (value) {
    case "High":
    case "Strong":
    case "Premium":
    case "White-glove":
      return 35;
    case "Medium":
    case "Possible":
    case "Moderate":
      return 20;
    case "Low":
      return 8;
    default:
      return 0;
  }
}

function toPriority(score: number): OpportunityPriority {
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function pushIfPositive(
  out: OpportunitySignal[],
  type: OpportunityType,
  score: number,
  rationale: string
) {
  if (score <= 0) return;

  out.push({
    type,
    score,
    priority: toPriority(score),
    rationale,
  });
}

export function scoreOpportunity(
  record: OpportunityRecord,
  values: OpportunityValues = {}
): OpportunitySignal[] {
  const out: OpportunitySignal[] = [];

  const text = normalizeText(
    record.aircraftType,
    record.dwellTime,
    record.passengerProfile,
    record.operatorType
  );

  const heavyJet = text.includes("heavy");
  const overnight = /overnight|2 days|3 days|multi-day|weekend|longer/.test(text);
  const quickTurn = /2 hours|3 hours|4 hours|same day|quick turn/.test(text);
  const leisureProfile = (record.passengerProfile || "").toLowerCase().includes("leisure");
  const charterOperator = (record.operatorType || "").toLowerCase().includes("charter");

  const confidenceBoost =
    record.confidence === "High" ? 15 : record.confidence === "Medium" ? 8 : 0;

  const detailingScore =
    boost(values.detailingOpportunity) +
    (quickTurn ? 12 : 0) +
    (overnight ? 18 : 0) +
    confidenceBoost;

  pushIfPositive(
    out,
    "detailing",
    detailingScore,
    "Ground time and service-fit indicators suggest aircraft cleaning or detailing relevance."
  );

  const maintenanceScore =
    boost(values.maintenanceWindow) +
    (overnight ? 20 : 0) +
    confidenceBoost;

  pushIfPositive(
    out,
    "maintenance",
    maintenanceScore,
    "Dwell time and service indicators suggest a maintenance window may exist."
  );

  const charterScore =
    boost(values.charterLeadPotential) +
    (charterOperator ? 15 : 0) +
    confidenceBoost;

  pushIfPositive(
    out,
    "charter",
    charterScore,
    "Operator profile and activity pattern suggest charter lead potential."
  );

  const conciergeScore =
    boost(values.conciergeNeed || values.conciergeLevel) +
    (heavyJet ? 15 : 0) +
    confidenceBoost;

  pushIfPositive(
    out,
    "concierge",
    conciergeScore,
    "Passenger profile and aircraft class suggest concierge potential."
  );

  const villaScore =
    boost(values.villaNeed) +
    (overnight ? 20 : 0) +
    (leisureProfile ? 10 : 0) +
    confidenceBoost;

  pushIfPositive(
    out,
    "villa",
    villaScore,
    "Stay length and travel profile suggest villa relevance."
  );

  const exoticScore =
    boost(values.exoticRentalNeed) +
    (heavyJet ? 10 : 0) +
    confidenceBoost;

  pushIfPositive(
    out,
    "exotic_rental",
    exoticScore,
    "Premium travel indicators suggest exotic rental potential."
  );

  const yachtScore = boost(values.yachtNeed) + confidenceBoost;

  pushIfPositive(
    out,
    "yacht",
    yachtScore,
    "Luxury travel profile suggests yacht-related ancillary opportunity."
  );

  return out.sort((a, b) => b.score - a.score);
}
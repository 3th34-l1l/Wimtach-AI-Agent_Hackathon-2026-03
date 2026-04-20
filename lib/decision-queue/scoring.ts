import type { LeadSignal } from "./contracts";

export function scoreLeadSignal(signal: LeadSignal) {
  const confidence = clamp(signal.serviceFit?.confidence ?? 50, 0, 100);
  const urgency = clamp(signal.serviceFit?.urgency ?? 50, 0, 100);
  const estimatedValueCad = Math.max(0, signal.serviceFit?.estimatedValueCad ?? 0);

  let score = 0;

  score += confidence * 0.35;
  score += urgency * 0.30;
  score += Math.min(estimatedValueCad / 1000, 100) * 0.20;

  if (signal.provenance.sourceLevel === "Observed") score += 8;
  if (signal.provenance.sourceLevel === "Mixed") score += 5;

  if (signal.provenance.signalTypes.includes("premium_airport")) score += 4;
  if (signal.provenance.signalTypes.includes("repeat_corridor")) score += 6;
  if (signal.provenance.signalTypes.includes("service_fit")) score += 8;
  if (signal.provenance.signalTypes.includes("contact_verified")) score += 10;

  const priority =
    score >= 78 ? "high" :
    score >= 55 ? "medium" :
    "low";

  return {
    score: Math.round(score),
    confidence,
    urgency,
    estimatedValueCad,
    priority,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
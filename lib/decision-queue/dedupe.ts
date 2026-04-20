import crypto from "crypto";
import type { LeadSignal } from "./contracts";

function clean(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function buildDecisionQueueFingerprint(signal: LeadSignal) {
  const serviceLine = clean(signal.serviceFit?.serviceLine) || "unknown-service-line";
  const opportunityType =
    clean(signal.serviceFit?.opportunityType) || "unknown-opportunity";
  const airport = clean(signal.airport?.icao) || "unknown-airport";
  const route = `${clean(signal.route?.from) || "x"}-${clean(signal.route?.to) || "x"}`;
  const operatorName = clean(signal.aircraft?.operator) || "unknown-operator";
  const aircraftType = clean(signal.aircraft?.aircraftType) || "unknown-aircraft";
  const tail = clean(signal.aircraft?.tail);

  const stableKey = tail
    ? ["tail", serviceLine, opportunityType, tail, airport].join("|")
    : [
        "operator",
        serviceLine,
        opportunityType,
        operatorName,
        aircraftType,
        airport,
        route,
      ].join("|");

  return crypto.createHash("sha256").update(stableKey).digest("hex");
}

// Backward-compatible alias in case another file imports the other name.
export const buildDecisionQueueDedupeHash = buildDecisionQueueFingerprint;
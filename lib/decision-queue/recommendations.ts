// FILE: lib/decision-queue/recommendations.ts

import type {
  LeadSignal,
  OpportunityType,
  ServiceLine,
  SourceLevel,
} from "./contracts";

export type RecommendationDraft = {
  title: string;
  subtitle: string | null;
  airport: string | null;
  route: string | null;
  operatorName: string | null;
  aircraftType: string | null;
  tail: string | null;
  opportunityType: OpportunityType;
  serviceLine: ServiceLine;
  recommendedAction: string;
  suggestedChannel: string;
  suggestedTiming: string;
  playbook: string;
  sourceLevel: SourceLevel;
  observedVsInferred: string;
  whySurfaced: string[];
  signalTypes: string[];
};

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function routeLabel(signal: LeadSignal) {
  const from = clean(signal.route?.from);
  const to = clean(signal.route?.to);
  if (!from || !to) return null;
  return `${from} → ${to}`;
}

function subtitleParts(signal: LeadSignal) {
  return uniq([
    clean(signal.aircraft?.tail),
    clean(signal.aircraft?.aircraftType),
    clean(signal.aircraft?.operator),
    clean(signal.airport?.icao),
    routeLabel(signal),
  ]);
}

function hasSignal(signal: LeadSignal, value: string) {
  return signal.provenance.signalTypes.includes(value);
}

function pickOpportunityType(signal: LeadSignal): OpportunityType {
  if (signal.serviceFit?.opportunityType) {
    return signal.serviceFit.opportunityType;
  }

  if (hasSignal(signal, "service_fit") && hasSignal(signal, "on_ground")) {
    return "detailing";
  }

  if (hasSignal(signal, "repeat_corridor") || hasSignal(signal, "premium_route")) {
    return "charter_sales";
  }

  if (hasSignal(signal, "partnership_fit") || hasSignal(signal, "traffic_density")) {
    return "operator_partnership";
  }

  if (hasSignal(signal, "multi_service_fit")) {
    return "multi_service";
  }

  return "concierge";
}

function pickServiceLine(signal: LeadSignal, opportunityType: OpportunityType): ServiceLine {
  if (signal.serviceFit?.serviceLine) {
    return signal.serviceFit.serviceLine;
  }

  switch (opportunityType) {
    case "detailing":
      return "Nous Systems Group";
    case "charter_sales":
      return "Nous Aviation";
    case "operator_partnership":
      return "Both";
    case "multi_service":
      return "Both";
    case "concierge":
    default:
      return "Nous Aviation";
  }
}

function buildWhySurfaced(signal: LeadSignal, opportunityType: OpportunityType) {
  const reasons: string[] = [];

  if (hasSignal(signal, "on_ground")) {
    reasons.push("Aircraft appears to be on the ground within an actionable service window.");
  }

  if (hasSignal(signal, "premium_airport") && signal.airport?.icao) {
    reasons.push(`Activity is tied to ${signal.airport.icao}, a premium airport context.`);
  }

  if (hasSignal(signal, "repeat_corridor") && signal.route?.from && signal.route?.to) {
    reasons.push(
      `Route pattern suggests repeat corridor activity on ${signal.route.from} → ${signal.route.to}.`
    );
  }

  if (hasSignal(signal, "contact_verified")) {
    reasons.push("A verified contact path exists, which improves outreach readiness.");
  }

  if (hasSignal(signal, "warm_intro")) {
    reasons.push("A warm introduction path may be available for outreach.");
  }

  if (hasSignal(signal, "traffic_density")) {
    reasons.push("Traffic density suggests recurring opportunity rather than one-off outreach.");
  }

  if (hasSignal(signal, "partnership_fit")) {
    reasons.push("Signals suggest a partnership-style commercial fit.");
  }

  if (hasSignal(signal, "llm_gap_fill")) {
    reasons.push("LLM gap-fill logic added missing operating context to improve lead clarity.");
  }

  switch (opportunityType) {
    case "detailing":
      reasons.push("Commercial fit aligns with a near-term detailing or turnaround offer.");
      break;
    case "charter_sales":
      reasons.push("Commercial fit aligns with a charter-style sales opportunity.");
      break;
    case "operator_partnership":
      reasons.push("Commercial fit aligns with an airport or operator relationship motion.");
      break;
    case "multi_service":
      reasons.push("Signals suggest more than one relevant service line.");
      break;
    case "concierge":
      reasons.push("Recommendation merits review even though the commercial fit is still emerging.");
      break;
  }

  if (reasons.length === 0) {
    reasons.push("Lead was promoted from live signal evaluation and queue-side scoring.");
  }

  return uniq(reasons).slice(0, 5);
}

function buildTitle(signal: LeadSignal, opportunityType: OpportunityType) {
  const airport = clean(signal.airport?.icao);
  const route = routeLabel(signal);
  const aircraftType = clean(signal.aircraft?.aircraftType);
  const operator = clean(signal.aircraft?.operator);

  switch (opportunityType) {
    case "detailing":
      if (airport) return `Offer detailing during dwell at ${airport}`;
      if (aircraftType) return `Offer detailing for ${aircraftType} movement`;
      return "Offer detailing based on live aircraft dwell";
    case "charter_sales":
      if (route) return `Pitch charter offer for ${route}`;
      if (airport) return `Review charter lead around ${airport}`;
      return "Pitch charter opportunity from route activity";
    case "operator_partnership":
      if (airport) return `Open partnership conversation at ${airport}`;
      if (operator) return `Open partnership conversation with ${operator}`;
      return "Open partnership conversation from recurring signal activity";
    case "multi_service":
      if (operator) return `Review multi-service opportunity for ${operator}`;
      return "Review multi-service commercial opportunity";
    case "concierge":
    default:
      if (airport) return `Review concierge lead near ${airport}`;
      return "Review certified lead opportunity";
  }
}

function buildRecommendedAction(signal: LeadSignal, opportunityType: OpportunityType) {
  const airport = clean(signal.airport?.icao);
  const route = routeLabel(signal);

  switch (opportunityType) {
    case "detailing":
      return airport
        ? `Contact the airport or FBO path at ${airport} and position a detailing offer.`
        : "Contact the operating path and position a detailing offer.";
    case "charter_sales":
      return route
        ? `Move this into charter outreach with a ${route} corridor-specific pitch.`
        : "Move this into charter outreach with a route-specific pitch.";
    case "operator_partnership":
      return "Research the operator or airport contact path and open a partnership conversation.";
    case "multi_service":
      return "Route to revenue operations for multi-service qualification and bundled positioning.";
    case "concierge":
    default:
      return "Review the signal bundle, confirm commercial fit, and route to the right owner.";
  }
}

function buildSuggestedChannel(signal: LeadSignal, opportunityType: OpportunityType) {
  if (hasSignal(signal, "warm_intro")) return "Warm intro";
  if (hasSignal(signal, "contact_verified")) return "Email + call";

  switch (opportunityType) {
    case "detailing":
      return "Phone first, email follow-up";
    case "charter_sales":
      return "Email intro + call";
    case "operator_partnership":
      return "Email + relationship outreach";
    case "multi_service":
      return "Ops review + outbound";
    case "concierge":
    default:
      return "Research + outreach";
  }
}

function buildSuggestedTiming(signal: LeadSignal, opportunityType: OpportunityType) {
  if (clean(signal.serviceFit?.actionWindow)) {
    return signal.serviceFit!.actionWindow!;
  }

  if (hasSignal(signal, "on_ground")) return "Within 30 minutes";
  if (hasSignal(signal, "repeat_corridor")) return "Today";

  switch (opportunityType) {
    case "operator_partnership":
      return "Within 48 hours";
    case "multi_service":
      return "This week";
    default:
      return "Today";
  }
}

function buildPlaybook(opportunityType: OpportunityType) {
  switch (opportunityType) {
    case "detailing":
      return "Overnight detailing package";
    case "charter_sales":
      return "Luxury charter corridor playbook";
    case "operator_partnership":
      return "Airport/operator relationship playbook";
    case "multi_service":
      return "Multi-service account expansion";
    case "concierge":
    default:
      return "Standard lead qualification";
  }
}

function buildObservedVsInferred(signal: LeadSignal) {
  const explanation = clean(signal.provenance.explanation);
  if (explanation) return explanation;

  switch (signal.provenance.sourceLevel) {
    case "Observed":
      return "Observed operational signals with limited inference.";
    case "Inferred":
      return "Inferred from traffic, route, or commercial-fit patterning.";
    case "Mixed":
    default:
      return "Observed signals combined with inferred commercial fit.";
  }
}

export function buildRecommendationDraft(signal: LeadSignal): RecommendationDraft {
  const opportunityType = pickOpportunityType(signal);
  const serviceLine = pickServiceLine(signal, opportunityType);

  return {
    title: buildTitle(signal, opportunityType),
    subtitle: subtitleParts(signal).join(" • ") || null,
    airport: clean(signal.airport?.icao),
    route: routeLabel(signal),
    operatorName: clean(signal.aircraft?.operator),
    aircraftType: clean(signal.aircraft?.aircraftType),
    tail: clean(signal.aircraft?.tail),
    opportunityType,
    serviceLine,
    recommendedAction: buildRecommendedAction(signal, opportunityType),
    suggestedChannel: buildSuggestedChannel(signal, opportunityType),
    suggestedTiming: buildSuggestedTiming(signal, opportunityType),
    playbook: buildPlaybook(opportunityType),
    sourceLevel: signal.provenance.sourceLevel,
    observedVsInferred: buildObservedVsInferred(signal),
    whySurfaced: buildWhySurfaced(signal, opportunityType),
    signalTypes: uniq(signal.provenance.signalTypes),
  };
}
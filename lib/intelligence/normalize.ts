// /lib/intelligence/normalize.ts

export type NormalizedRecord = {
  mode: string;
  companyName: string;
  airport: string;
  aircraftType: string;
  tailNumber: string;
  operatorType: string;
  publicWebsite: string;
  businessEmail: string;
  publicPhone: string;
  linkedFBO: string;
  passengerProfile: string;
  dwellTime: string;
  opportunityType: string;
  opportunitySummary: string;
  confidence: string;
  sourceLevel: string;
  reviewStatus: string;
  hubspotReady: string;
  hunterReady: string;
  leadOwner: string;
  pipelineStage: string;
  crmNotes: string;
};

export function buildNormalizedRecord(
  mode: string,
  values: Record<string, string>
): NormalizedRecord {
  const opportunityType =
    mode === "service"
      ? "Service Opportunity"
      : mode === "luxury"
      ? "Luxury / Ancillary"
      : mode === "operator"
      ? "Operator Outreach"
      : mode === "movement"
      ? "Pattern Review"
      : "Asset / Trip Review";

  return {
    mode,
    companyName: values.operatorName || "",
    airport: values.airport || "",
    aircraftType: values.aircraftType || "",
    tailNumber: values.tailNumber || "",
    operatorType: values.operatorType || "",
    publicWebsite: values.publicWebsite || "",
    businessEmail: values.businessEmail || "",
    publicPhone: values.publicPhone || "",
    linkedFBO: values.linkedFBO || "",
    passengerProfile: values.passengerProfile || "",
    dwellTime: values.dwellTime || "",
    opportunityType,
    opportunitySummary:
      values.serviceNotes ||
      values.opportunitySummary ||
      values.notes ||
      values.observedPattern ||
      "",
    confidence: values.confidence || "",
    sourceLevel: values.sourceLevel || "",
    reviewStatus: values.reviewStatus || "",
    hubspotReady: values.hubspotReady || "",
    hunterReady: values.hunterReady || "",
    leadOwner: values.leadOwner || "",
    pipelineStage: values.pipelineStage || "",
    crmNotes: values.crmNotes || "",
  };
}
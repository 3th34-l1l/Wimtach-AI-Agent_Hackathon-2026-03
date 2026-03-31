export type ProjectRecord = {
  project_id: string | number;
  project_name?: string | null;
  project_stage?: string | null;
  construction_type?: string | null;
  location_type?: string | null;
  primary_sector?: string | null;
  state?: string | null;
  country?: string | null;
  city?: string | null;
  project_value_usd?: string | number | null;
};

export type ProjectSignals = {
  sectorRoot: string;
  sectorPath: string[];
  coordinationBurden: "Low" | "Medium" | "High";
  reviewSensitivity: "Low" | "Medium" | "High";
  environment: "Onshore" | "Offshore";
  complexity: string;
  stageUrgency: "Low" | "Medium" | "High";
  commercialAttractiveness: "Low" | "Medium" | "High";
  leadPriority: "Low" | "Medium" | "High";
  valueBand: "Unknown" | "Small" | "Mid-Market" | "Major" | "Mega";
  normalizedValueUsd: number | null;
  geographyLabel: string;
  summary: string;
  insights: string[];
  opportunitySignals: string[];
  riskSignals: string[];
  recommendedActions: string[];
  tags: string[];
  searchableText: string;
  scores: {
    valueScore: number;
    stageScore: number;
    complexityScore: number;
    coordinationScore: number;
    sectorScore: number;
    totalLeadScore: number;
  };
};

function normalizeUsdValue(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

function getValueBand(value: number | null): ProjectSignals["valueBand"] {
  if (value === null) return "Unknown";
  if (value < 10_000_000) return "Small";
  if (value < 100_000_000) return "Mid-Market";
  if (value < 500_000_000) return "Major";
  return "Mega";
}

function getValueScore(valueBand: ProjectSignals["valueBand"]): number {
  switch (valueBand) {
    case "Mega":
      return 5;
    case "Major":
      return 4;
    case "Mid-Market":
      return 3;
    case "Small":
      return 2;
    default:
      return 1;
  }
}

function getStageScore(stage?: string | null): number {
  switch ((stage || "").trim()) {
    case "Execution":
      return 5;
    case "Design":
      return 4;
    case "Planning":
      return 3;
    case "Pre-Planning":
      return 2;
    case "Complete":
      return 1;
    default:
      return 2;
  }
}

function getCoordinationScore(companyCount = 0): number {
  if (companyCount >= 8) return 5;
  if (companyCount >= 4) return 3;
  return 1;
}

function getComplexityScore(constructionType?: string | null): number {
  switch ((constructionType || "").trim()) {
    case "Redevelopment":
    case "Renovation":
      return 5;
    case "New":
      return 3;
    default:
      return 4;
  }
}

function getSectorScore(sectorRoot: string): number {
  const highValueSectors = [
    "Energy",
    "Power",
    "Data Centers",
    "Healthcare",
    "Industrial",
    "Transportation",
    "Infrastructure",
    "Oil & Gas",
    "Mining",
  ];

  const mediumValueSectors = [
    "Commercial",
    "Residential",
    "Education",
    "Hospitality",
    "Mixed Use",
  ];

  if (highValueSectors.some((s) => sectorRoot.toLowerCase().includes(s.toLowerCase()))) {
    return 5;
  }

  if (mediumValueSectors.some((s) => sectorRoot.toLowerCase().includes(s.toLowerCase()))) {
    return 3;
  }

  return 2;
}

export function inferProjectSignals(
  project: ProjectRecord,
  companyCount = 0
): ProjectSignals {
  const sectorPath = (project.primary_sector || "")
    .split("-->")
    .map((s) => s.trim())
    .filter(Boolean);

  const sectorRoot = sectorPath[0] || "Unknown";

  const coordinationBurden: ProjectSignals["coordinationBurden"] =
    companyCount >= 8 ? "High" : companyCount >= 4 ? "Medium" : "Low";

  const reviewSensitivity: ProjectSignals["reviewSensitivity"] =
    project.project_stage === "Execution"
      ? "High"
      : project.project_stage === "Planning" || project.project_stage === "Design"
      ? "Medium"
      : "Low";

  const environment: ProjectSignals["environment"] =
    project.location_type === "Offshore" ? "Offshore" : "Onshore";

  const complexity =
    project.construction_type === "Redevelopment" ||
    project.construction_type === "Renovation"
      ? "Existing-site complexity"
      : project.construction_type === "New"
      ? "New-build coordination"
      : "Mixed project complexity";

  const normalizedValueUsd = normalizeUsdValue(project.project_value_usd);
  const valueBand = getValueBand(normalizedValueUsd);

  const geographyLabel =
    [project.city, project.state, project.country].filter(Boolean).join(", ") || "Unknown location";

  const stageScore = getStageScore(project.project_stage);
  const valueScore = getValueScore(valueBand);
  const coordinationScore = getCoordinationScore(companyCount);
  const complexityScore = getComplexityScore(project.construction_type);
  const sectorScore = getSectorScore(sectorRoot);

  const totalLeadScore =
    valueScore + stageScore + coordinationScore + complexityScore + sectorScore;

  const stageUrgency: ProjectSignals["stageUrgency"] =
    project.project_stage === "Execution"
      ? "High"
      : project.project_stage === "Design" || project.project_stage === "Planning"
      ? "Medium"
      : "Low";

  const commercialAttractiveness: ProjectSignals["commercialAttractiveness"] =
    totalLeadScore >= 20 ? "High" : totalLeadScore >= 14 ? "Medium" : "Low";

  const leadPriority: ProjectSignals["leadPriority"] =
    totalLeadScore >= 20
      ? "High"
      : totalLeadScore >= 14
      ? "Medium"
      : "Low";

  const summary = [
    project.project_name || `Project ${project.project_id}`,
    project.project_stage ? `${project.project_stage} stage` : null,
    geographyLabel !== "Unknown location" ? geographyLabel : null,
    sectorRoot !== "Unknown" ? sectorRoot : null,
    project.construction_type || null,
    environment,
    valueBand !== "Unknown" ? `${valueBand} value` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const insights = [
    `${environment} project environment.`,
    `${complexity}.`,
    `Coordination burden appears ${coordinationBurden.toLowerCase()} based on linked-company count.`,
    `Review sensitivity is ${reviewSensitivity.toLowerCase()} based on project stage.`,
    normalizedValueUsd !== null
      ? `Project value falls into the ${valueBand.toLowerCase()} band.`
      : `Project value is not available, so commercial sizing is estimated from other signals.`,
    `Overall lead priority is ${leadPriority.toLowerCase()}.`,
  ];

  const opportunitySignals = [
    valueBand === "Mega" || valueBand === "Major"
      ? "Large commercial opportunity due to project value."
      : null,
    project.project_stage === "Planning" || project.project_stage === "Design"
      ? "Good timing for early relationship-building and specification influence."
      : null,
    project.project_stage === "Execution"
      ? "Execution-stage activity may support immediate outreach and active vendor engagement."
      : null,
    companyCount >= 4
      ? "Multi-company involvement suggests broader coordination needs and multiple entry points."
      : null,
    environment === "Offshore"
      ? "Offshore context may create specialized service and compliance opportunities."
      : null,
  ].filter(Boolean) as string[];

  const riskSignals = [
    companyCount >= 8
      ? "High stakeholder count may slow decisions and increase coordination friction."
      : null,
    project.construction_type === "Redevelopment" ||
    project.construction_type === "Renovation"
      ? "Existing-site constraints may introduce hidden complexity, access limitations, or scope shifts."
      : null,
    project.project_stage === "Complete"
      ? "Completed stage may reduce immediate lead value unless the goal is service, retrofit, or future-phase capture."
      : null,
    sectorRoot === "Unknown"
      ? "Sector classification is missing or unclear, reducing targeting precision."
      : null,
    normalizedValueUsd === null
      ? "Project value is missing, which lowers confidence in lead ranking."
      : null,
  ].filter(Boolean) as string[];

  const recommendedActions = [
    leadPriority === "High"
      ? "Surface this project in high-priority lead queues."
      : null,
    project.project_stage === "Planning" || project.project_stage === "Design"
      ? "Recommend preconstruction, specification, or advisory outreach."
      : null,
    project.project_stage === "Execution"
      ? "Recommend immediate active-project outreach and competitor mapping."
      : null,
    companyCount >= 4
      ? "Show linked-company network view to identify relationship paths."
      : null,
    sectorRoot !== "Unknown"
      ? `Use ${sectorRoot} sector messaging in summaries, filters, and sales prompts.`
      : null,
    normalizedValueUsd === null
      ? "Prompt for value enrichment or external data matching."
      : null,
  ].filter(Boolean) as string[];

  const tags = [
    sectorRoot,
    project.project_stage || "Unknown Stage",
    project.construction_type || "Unknown Construction Type",
    environment,
    coordinationBurden,
    reviewSensitivity,
    valueBand,
    leadPriority,
    project.state || null,
    project.country || null,
  ].filter(Boolean) as string[];

  const searchableText = [
    project.project_name,
    project.project_stage,
    project.construction_type,
    project.location_type,
    project.primary_sector,
    project.city,
    project.state,
    project.country,
    sectorRoot,
    geographyLabel,
    valueBand,
    leadPriority,
    ...opportunitySignals,
    ...riskSignals,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    sectorRoot,
    sectorPath,
    coordinationBurden,
    reviewSensitivity,
    environment,
    complexity,
    stageUrgency,
    commercialAttractiveness,
    leadPriority,
    valueBand,
    normalizedValueUsd,
    geographyLabel,
    summary,
    insights,
    opportunitySignals,
    riskSignals,
    recommendedActions,
    tags,
    searchableText,
    scores: {
      valueScore,
      stageScore,
      complexityScore,
      coordinationScore,
      sectorScore,
      totalLeadScore,
    },
  };
}
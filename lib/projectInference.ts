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

export function inferProjectSignals(project: ProjectRecord, companyCount = 0) {
  const sectorRoot =
    project.primary_sector?.split(" --> ")[0]?.trim() || "Unknown";

  const coordinationBurden =
    companyCount >= 8
      ? "High"
      : companyCount >= 4
      ? "Medium"
      : "Low";

  const reviewSensitivity =
    project.project_stage === "Execution"
      ? "High"
      : project.project_stage === "Planning" ||
        project.project_stage === "Design"
      ? "Medium"
      : "Low";

  const environment =
    project.location_type === "Offshore"
      ? "Offshore"
      : "Onshore";

  const complexity =
    project.construction_type === "Redevelopment" ||
    project.construction_type === "Renovation"
      ? "Existing-site complexity"
      : project.construction_type === "New"
      ? "New-build coordination"
      : "Mixed project complexity";

  const summary = [
    project.project_name,
    project.project_stage ? `${project.project_stage} stage` : null,
    project.city || project.state || project.country
      ? [project.city, project.state, project.country].filter(Boolean).join(", ")
      : null,
    sectorRoot !== "Unknown" ? sectorRoot : null,
    project.construction_type || null,
    environment,
  ]
    .filter(Boolean)
    .join(" • ");

  const insights = [
    `${environment} project environment.`,
    `${complexity}.`,
    `Coordination burden appears ${coordinationBurden.toLowerCase()} based on linked-company count.`,
    `Review sensitivity is ${reviewSensitivity.toLowerCase()} based on project stage.`,
  ];

  return {
    sectorRoot,
    coordinationBurden,
    reviewSensitivity,
    environment,
    complexity,
    summary,
    insights,
  };
}
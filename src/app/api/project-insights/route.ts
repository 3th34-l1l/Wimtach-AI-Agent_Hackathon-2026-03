import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [
    kpis,
    stages,
    states,
    sectors,
    constructionTypes,
    locationTypes,
    metrics,
    companyComplexity,
  ] = await Promise.all([
    db.query(`
      select
        (select count(*) from projects)::int as total_projects,
        (select count(*) from project_locations)::int as total_locations,
        (select count(*) from project_operating_metrics)::int as total_metrics,
        (select count(*) from project_subprojects)::int as total_subprojects,
        (select count(*) from project_companies)::int as total_project_companies,
        (select count(*) from companies)::int as total_companies
    `),
    db.query(`
      select project_stage, count(*)::int as count
      from projects
      group by project_stage
      order by count desc
      limit 10
    `),
    db.query(`
      select state, count(*)::int as count
      from projects
      where state is not null
      group by state
      order by count desc
      limit 10
    `),
    db.query(`
      select split_part(primary_sector, ' --> ', 1) as sector_root, count(*)::int as count
      from projects
      where primary_sector is not null
      group by sector_root
      order by count desc
      limit 10
    `),
    db.query(`
      select construction_type, count(*)::int as count
      from projects
      group by construction_type
      order by count desc
      limit 10
    `),
    db.query(`
      select location_type, count(*)::int as count
      from projects
      group by location_type
      order by count desc
      limit 10
    `),
    db.query(`
      select parameter, count(*)::int as count
      from project_operating_metrics
      where parameter is not null
      group by parameter
      order by count desc
      limit 15
    `),
    db.query(`
      select
        round(avg(company_count)::numeric, 2) as avg_companies_per_project,
        percentile_cont(0.5) within group (order by company_count) as median_companies_per_project,
        count(*) filter (where company_count > 1)::int as projects_with_multiple_companies
      from (
        select project_id, count(*) as company_count
        from project_companies
        group by project_id
      ) t
    `),
  ]);

  return NextResponse.json({
    headline_kpis: kpis.rows[0],
    distributions: {
      project_stage: stages.rows,
      state: states.rows,
      sector_root: sectors.rows,
      construction_type: constructionTypes.rows,
      location_type: locationTypes.rows,
    },
    metrics: {
      top_parameters: metrics.rows,
    },
    companies: companyComplexity.rows[0],
    insights: [
      "The dataset is large enough to support contextual project analysis, not just report storage.",
      "Project-company relationships indicate strong multi-party coordination complexity.",
      "Sector, stage, and construction type can already support real filtering and inference.",
      "Operating metrics create a strong base for project-scale and facility-type analysis.",
    ],
  });
}
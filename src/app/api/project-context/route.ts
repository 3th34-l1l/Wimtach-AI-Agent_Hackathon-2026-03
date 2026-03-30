import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const projectRes = await db.query(
    `
    select *
    from projects
    where project_id = $1
    limit 1
    `,
    [projectId]
  );

  if (projectRes.rowCount === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const locationsRes = await db.query(
    `
    select city, state, country, latitude, longitude, project_post_code, is_primary, sort_order
    from project_locations
    where project_id = $1
    order by sort_order asc nulls last
    `,
    [projectId]
  );

  const metricsRes = await db.query(
    `
    select facility_type, parameter, unit_value, unit_name, product_name
    from project_operating_metrics
    where project_id = $1
    order by parameter asc
    limit 50
    `,
    [projectId]
  );

  const subprojectsRes = await db.query(
    `
    select sub_project_id, sub_project_name
    from project_subprojects
    where parent_project_id = $1
    limit 50
    `,
    [projectId]
  );

  const companiesRes = await db.query(
    `
    select pc.company_id, pc.company_name, pc.company_ticker, c.country, c.industry
    from project_companies pc
    left join companies c on pc.company_id = c.company_id
    where pc.project_id = $1
    limit 50
    `,
    [projectId]
  );

  return NextResponse.json({
    project: projectRes.rows[0],
    locations: locationsRes.rows,
    metrics: metricsRes.rows,
    subprojects: subprojectsRes.rows,
    companies: companiesRes.rows,
  });
}
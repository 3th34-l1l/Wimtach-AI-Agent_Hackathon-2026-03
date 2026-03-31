import { NextRequest, NextResponse } from "next/server";

function tokenizeQuery(q: string) {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.length >= 3)
    .filter(
      (x) =>
        ![
          "the",
          "and",
          "for",
          "with",
          "from",
          "that",
          "this",
          "project",
          "projects",
        ].includes(x)
    );
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  try {
    const { db } = await import("@/lib/db");
    const { inferProjectSignals } = await import("@/lib/projectInference");

    const tokens = tokenizeQuery(q);

    let searchRes = await db.query(
      `
      select
        project_id,
        project_name,
        project_stage,
        city,
        state,
        country,
        construction_type,
        location_type,
        primary_sector,
        project_value_usd
      from projects
      where
        project_name ilike $1
        or city ilike $1
        or state ilike $1
        or country ilike $1
        or primary_sector ilike $1
        or construction_type ilike $1
        or project_stage ilike $1
      order by project_value_usd desc nulls last
      limit 10
      `,
      [`%${q}%`]
    );

    if (searchRes.rowCount === 0 && tokens.length > 0) {
      const conditions: string[] = [];
      const values: string[] = [];

      tokens.forEach((token, i) => {
        const idx = i + 1;
        conditions.push(`
          (
            project_name ilike $${idx}
            or city ilike $${idx}
            or state ilike $${idx}
            or country ilike $${idx}
            or primary_sector ilike $${idx}
            or construction_type ilike $${idx}
            or project_stage ilike $${idx}
          )
        `);
        values.push(`%${token}%`);
      });

      searchRes = await db.query(
        `
        select
          project_id,
          project_name,
          project_stage,
          city,
          state,
          country,
          construction_type,
          location_type,
          primary_sector,
          project_value_usd
        from projects
        where ${conditions.join(" and ")}
        order by project_value_usd desc nulls last
        limit 10
        `,
        values
      );
    }

    if (searchRes.rowCount === 0) {
      return NextResponse.json({
        found: false,
        message: `No matching projects found for "${q}".`,
        matches: [],
      });
    }

    const topProject = searchRes.rows[0];

    const [locationsRes, metricsRes, companiesRes, subprojectsRes] =
      await Promise.all([
        db.query(
          `
          select city, state, country, latitude, longitude, project_post_code, is_primary
          from project_locations
          where project_id = $1
          order by sort_order asc nulls last
          limit 20
          `,
          [topProject.project_id]
        ),
        db.query(
          `
          select facility_type, parameter, unit_value, unit_name, product_name
          from project_operating_metrics
          where project_id = $1
          order by parameter asc
          limit 20
          `,
          [topProject.project_id]
        ),
        db.query(
          `
          select
            pc.company_id,
            pc.company_name,
            pc.company_ticker,
            c.industry,
            c.country
          from project_companies pc
          left join companies c on c.company_id = pc.company_id
          where pc.project_id = $1
          limit 20
          `,
          [topProject.project_id]
        ),
        db.query(
          `
          select sub_project_id, sub_project_name
          from project_subprojects
          where parent_project_id = $1
          limit 20
          `,
          [topProject.project_id]
        ),
      ]);

    const inferred = inferProjectSignals(
      topProject,
      companiesRes.rows.length
    );

    return NextResponse.json({
      found: true,
      query: q,
      topMatch: topProject,
      matches: searchRes.rows,
      projectContext: {
        project: topProject,
        locations: locationsRes.rows,
        metrics: metricsRes.rows,
        companies: companiesRes.rows,
        subprojects: subprojectsRes.rows,
        inferred,
      },
    });
  } catch (error: any) {
    console.error("chat-context error:", error);

    return NextResponse.json(
      {
        found: false,
        fallback: true,
        query: q,
        message:
          "Project-specific context is temporarily unavailable. Using general construction safety context instead.",
        error: String(error?.message || error),
        matches: [],
        projectContext: null,
      },
      { status: 500 }
    );
  }
}
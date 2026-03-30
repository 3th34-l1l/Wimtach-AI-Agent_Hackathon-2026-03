import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const result = await db.query(
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
      split_part(primary_sector, ' --> ', 1) as sector_root,
      project_value_usd
    from projects
    where
      project_name ilike $1
      or city ilike $1
      or state ilike $1
      or country ilike $1
    order by project_value_usd desc nulls last
    limit 15
    `,
    [`%${q}%`]
  );

  return NextResponse.json({ results: result.rows });
}
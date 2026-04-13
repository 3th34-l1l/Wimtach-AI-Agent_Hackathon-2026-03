import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const limit = Number(searchParams.get("limit") || 18);
    const source = searchParams.get("source");
    const urgentOnly = searchParams.get("urgentOnly") === "true";
    const publishedOnly = searchParams.get("publishedOnly") !== "false";

    const values: any[] = [];
    const where: string[] = [];

    if (publishedOnly) {
      values.push("published");
      where.push(`publish_status = $${values.length}`);
    }

    if (source) {
      values.push(source);
      where.push(`source = $${values.length}`);
    }

    if (urgentOnly) {
      where.push(`dep_utc <= NOW() + INTERVAL '48 hours'`);
    }

    values.push(limit);

    const sql = `
      SELECT
        id,
        source,
        origin_label AS "originLabel",
        dest_label AS "destLabel",
        route_label AS "routeLabel",
        dep_utc AS "depUtc",
        arr_utc AS "arrUtc",
        seats_available AS "seatsAvailable",
        min_price_usd AS "minPriceUsd",
        aircraft_type AS "aircraftType",
        operator_name AS "operatorName",
        publish_status AS "publishStatus",
        image_url AS "imageUrl",
        package_hint AS "packageHint",
        updated_at AS "updatedAt"
      FROM empty_legs
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY dep_utc ASC
      LIMIT $${values.length};
    `;

    const result = await pool.query(sql, values);

    return NextResponse.json({
      ok: true,
      rows: result.rows,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load live inventory" },
      { status: 500 }
    );
  }
}
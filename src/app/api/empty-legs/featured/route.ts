import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __emptyLegsPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

const pool =
  global.__emptyLegsPool ||
  new Pool({
    connectionString,
    ssl:
      connectionString && !connectionString.includes("localhost")
        ? { rejectUnauthorized: false }
        : false,
  });

if (!global.__emptyLegsPool) {
  global.__emptyLegsPool = pool;
}

export async function GET(req: NextRequest) {
  if (!connectionString) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not set" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);

    const limitRaw = Number(searchParams.get("limit") || 18);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(limitRaw, 50))
      : 18;

    const source = searchParams.get("source");
    const urgentOnly = searchParams.get("urgentOnly") === "true";
    const publishedOnly = searchParams.get("publishedOnly") !== "false";

    const values: unknown[] = [];
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
      ORDER BY dep_utc ASC NULLS LAST
      LIMIT $${values.length};
    `;

    const result = await pool.query(sql, values);

    return NextResponse.json({
      ok: true,
      rows: result.rows,
    });
  } catch (error: any) {
    console.error("empty-legs/featured failed", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load live inventory",
      },
      { status: 500 }
    );
  }
}
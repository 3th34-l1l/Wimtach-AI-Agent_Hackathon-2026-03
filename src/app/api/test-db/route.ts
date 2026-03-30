import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const res = await db.query("select count(*) from projects");
  return NextResponse.json({ ok: true, count: res.rows[0].count });
}
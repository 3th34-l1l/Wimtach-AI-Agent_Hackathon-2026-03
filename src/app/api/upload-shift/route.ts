/* ===========================
FILE: /app/api/upload-shift/route.ts
Fix Excel serial dates + normalize schedule rows
=========================== */

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

type ShiftRow = {
  date?: string;  // YYYY-MM-DD
  start?: string; // HH:MM
  end?: string;   // HH:MM
  unit?: string;
  team?: string;
};

function norm(v: any) {
  return String(v ?? "").trim();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Excel serial date -> YYYY-MM-DD (handles fractional days)
function excelSerialToISO(n: number) {
  // Excel epoch: 1899-12-30 (because of Excel leap-year bug)
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const ms = Math.round(n * 24 * 60 * 60 * 1000);
  const dt = new Date(excelEpoch.getTime() + ms);

  const y = dt.getUTCFullYear();
  const m = pad2(dt.getUTCMonth() + 1);
  const d = pad2(dt.getUTCDate());
  return `${y}-${m}-${d}`;
}

// Try to parse various date inputs into YYYY-MM-DD
function coerceISODate(v: any): string {
  if (v == null) return "";

  // 1) numeric excel serial
  if (typeof v === "number" && Number.isFinite(v)) {
    // typical modern excel serials are > 40000
    if (v > 20000) return excelSerialToISO(v);
  }

  const s = norm(v);
  if (!s) return "";

  // 2) already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // 3) M/D/YYYY or MM/DD/YYYY
  const mdY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (mdY) {
    const mm = pad2(Number(mdY[1]));
    const dd = pad2(Number(mdY[2]));
    const yy = mdY[3];
    return `${yy}-${mm}-${dd}`;
  }

  // 4) MM-DD-YYYY
  const mdY2 = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (mdY2) {
    const mm = pad2(Number(mdY2[1]));
    const dd = pad2(Number(mdY2[2]));
    const yy = mdY2[3];
    return `${yy}-${mm}-${dd}`;
  }

  // 5) best-effort Date parse
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const m = pad2(dt.getMonth() + 1);
    const d = pad2(dt.getDate());
    return `${y}-${m}-${d}`;
  }

  return s; // fallback (won’t break UI)
}

function coerceHHMM(v: any): string {
  const s = norm(v);
  if (!s) return "";

  // Already HH:MM
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":").map(Number);
    return `${pad2(h)}:${pad2(m)}`;
  }

  // Excel time as fraction of day (e.g. 0.5 == 12:00)
  const num = Number(s);
  if (Number.isFinite(num) && num > 0 && num < 1) {
    const total = Math.round(num * 24 * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${pad2(hh)}:${pad2(mm)}`;
  }

  return s;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());

  // CSV or XLSX
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

  // Try common header names
  const rows: ShiftRow[] = json.map((r) => {
    const dateRaw = r.date ?? r.Date ?? r.DATE ?? r.day ?? r.Day ?? r.DAY;
    const startRaw = r.start ?? r.Start ?? r.START;
    const endRaw = r.end ?? r.End ?? r.END;
    const unitRaw = r.unit ?? r.Unit ?? r.UNIT;
    const teamRaw = r.team ?? r.Team ?? r.TEAM;

    return {
      date: coerceISODate(dateRaw),
      start: coerceHHMM(startRaw),
      end: coerceHHMM(endRaw),
      unit: norm(unitRaw),
      team: norm(teamRaw),
    };
  });

  return NextResponse.json({ rows });
}
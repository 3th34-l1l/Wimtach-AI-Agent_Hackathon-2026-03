/* ===========================
FILE: /app/api/upload-shift/route.ts

V2: Upload Context Pipeline
- detects dataset type
- explains purpose in plain language
- suggests project matches
- returns stakeholder-friendly explanation
=========================== */

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";

type Row = Record<string, any>;

function norm(v: any) {
  return String(v ?? "").trim();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function excelSerialToISO(n: number) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const ms = Math.round(n * 86400000);
  const dt = new Date(excelEpoch.getTime() + ms);

  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function coerceISODate(v: any): string {
  if (typeof v === "number" && v > 20000) return excelSerialToISO(v);

  const s = norm(v);
  if (!s) return "";

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  }

  return s;
}

// 🔍 Detect dataset type
function detectDataset(headers: string[]) {
  if (headers.includes("projectid")) return "project_data";
  if (headers.includes("companyname")) return "company_data";
  if (headers.includes("date") && headers.includes("start")) return "schedule";
  if (headers.some(h => h.includes("hazard") || h.includes("incident"))) return "safety";
  return "unknown";
}

// 🧠 Plain-language explanation
function getDetectedUse(type: string) {
  switch (type) {
    case "project_data":
      return "supporting project context";
    case "company_data":
      return "contractor / organization context";
    case "schedule":
      return "workforce or shift context";
    case "safety":
      return "safety observation or incident context";
    default:
      return "unclassified supporting file";
  }
}

// 📊 confidence heuristic
function estimateConfidence(headers: string[]) {
  if (headers.length > 6) return "high";
  if (headers.length > 3) return "moderate";
  return "low";
}

// 🔗 try match projects from text in file
async function suggestProjectLinks(rows: Row[]) {
  try {
    const sampleText = rows
      .slice(0, 20)
      .flatMap(r => Object.values(r))
      .join(" ")
      .toLowerCase();

    if (!sampleText) return [];

    const result = await db.query(
      `
      select project_id, project_name, city, state, country
      from projects
      where
        project_name ilike $1
        or city ilike $1
        or state ilike $1
      limit 3
      `,
      [`%${sampleText.slice(0, 100)}%`]
    );

    return result.rows.map((p: any) => ({
      projectId: p.project_id,
      projectName: p.project_name,
      location: [p.city, p.state, p.country].filter(Boolean).join(", "),
      reason: "Matched text patterns in uploaded file",
    }));
  } catch {
    return [];
  }
}

// 🧠 stakeholder explanation
function buildWhyThisMatters(type: string, links: any[]) {
  const base = {
    project_data: [
      "This file appears to contain project-level information.",
      "It may help enrich or validate project context already in the system.",
    ],
    company_data: [
      "This file appears to describe contractors or organizations.",
      "It may help explain coordination complexity or responsibility mapping.",
    ],
    schedule: [
      "This file appears to describe workforce or shift context.",
      "It may help explain who was active when an issue or pattern occurred.",
    ],
    safety: [
      "This file appears to contain safety-related observations or incidents.",
      "It may support trend detection or committee review.",
    ],
    unknown: [
      "The system could not clearly classify this file.",
      "It may still provide useful supporting context depending on how it is interpreted.",
    ],
  };

  const lines = base[type as keyof typeof base] || base.unknown;

  if (links.length) {
    lines.push("The system found possible project matches based on file content.");
  }

  return lines;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });

  const headers = Object.keys(json[0] || {}).map(h => h.toLowerCase());

  const detectedType = detectDataset(headers);
  const detectedUse = getDetectedUse(detectedType);
  const confidence = estimateConfidence(headers);

  const projectLinks = await suggestProjectLinks(json);

  const summary = {
    rows: json.length,
    columns: headers.length,
    detectedType,
    confidence,
  };

  return NextResponse.json({
    ok: true,
    detectedType,
    detectedUse,
    confidence,
    summary,
    columns: headers,
    possibleProjectLinks: projectLinks,
    whyThisMatters: buildWhyThisMatters(detectedType, projectLinks),
    rows: json.slice(0, 200),
  });
}
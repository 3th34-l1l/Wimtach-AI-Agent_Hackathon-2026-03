import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParsedIntent = {
  cleaned: string;
  normalized: string;
  tokens: string[];
  city: string | null;
  state: string | null;
  country: string | null;
  stage: string | null;
  sector: string | null;
  constructionType: string | null;
  environmentHint: string | null;
  valueHint: boolean;
  analyticsIntent: boolean;
  riskIntent: boolean;
};

type ProjectRow = {
  project_id: string | number;
  project_name?: string | null;
  project_stage?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  construction_type?: string | null;
  location_type?: string | null;
  primary_sector?: string | null;
  project_value_usd?: string | number | null;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "project",
  "projects",
  "construction",
  "build",
  "building",
  "want",
  "show",
  "find",
  "me",
  "about",
  "in",
  "of",
  "on",
  "at",
  "to",
  "please",
  "can",
  "you",
  "give",
  "tell",
  "looking",
  "review",
  "analysis",
]);

const PHRASE_NORMALIZATIONS: Array<[RegExp, string]> = [
  [/[\u2022"'`]+/g, " "],
  [/\s+/g, " "],
  [/\bconsturction\b/g, "construction"],
  [/\bcontruction\b/g, "construction"],
  [/\bprokects\b/g, "projects"],
  [/\bporjects\b/g, "projects"],
  [/\bhospitial\b/g, "hospital"],
  [/\bont\b/g, "ontario"],
  [/\busa\b/g, "united states"],
  [/\bus\b/g, "united states"],
  [/\bhigh value\b/g, "high value"],
  [/\bbiggest\b/g, "largest"],
];

const KNOWN_CITIES = [
  "toronto",
  "vancouver",
  "calgary",
  "montreal",
  "ottawa",
  "mississauga",
  "new york",
  "miami",
  "houston",
  "dallas",
  "los angeles",
  "san francisco",
];

const KNOWN_STATES = [
  "ontario",
  "british columbia",
  "alberta",
  "quebec",
  "florida",
  "texas",
  "california",
  "new york",
];

const KNOWN_COUNTRIES = ["canada", "united states"];

const KNOWN_STAGES = [
  "planning",
  "design",
  "execution",
  "construction",
  "preconstruction",
  "completed",
];

const KNOWN_SECTORS = [
  "hospital",
  "healthcare",
  "energy",
  "transportation",
  "infrastructure",
  "industrial",
  "residential",
  "commercial",
  "utility",
  "nuclear",
  "renewable",
  "mixed-use",
  "redevelopment",
];

const KNOWN_CONSTRUCTION_TYPES = [
  "residential",
  "commercial",
  "industrial",
  "infrastructure",
  "redevelopment",
  "expansion",
  "refurbishment",
  "mixed-use",
];

const KNOWN_ENVIRONMENTS = ["offshore", "onshore", "urban", "remote"];

function cleanInput(q: string) {
  let out = String(q ?? "").toLowerCase();
  for (const [pattern, replacement] of PHRASE_NORMALIZATIONS) {
    out = out.replace(pattern, replacement);
  }
  return out.trim();
}

function tokenizeQuery(q: string) {
  return cleanInput(q)
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.length >= 3)
    .filter((x) => !STOP_WORDS.has(x));
}

function findPhrase(text: string, phrases: string[]) {
  return phrases.find((p) => text.includes(p)) || null;
}

function parseIntent(q: string): ParsedIntent {
  const cleaned = String(q ?? "").trim();
  const normalized = cleanInput(q);

  const city = findPhrase(normalized, KNOWN_CITIES);
  const state = findPhrase(normalized, KNOWN_STATES);
  const country = findPhrase(normalized, KNOWN_COUNTRIES);
  const stage = findPhrase(normalized, KNOWN_STAGES);
  const sector = findPhrase(normalized, KNOWN_SECTORS);
  const constructionType = findPhrase(normalized, KNOWN_CONSTRUCTION_TYPES);
  const environmentHint = findPhrase(normalized, KNOWN_ENVIRONMENTS);

  const valueHint =
    normalized.includes("largest") ||
    normalized.includes("high value") ||
    normalized.includes("top value") ||
    normalized.includes("highest value") ||
    normalized.includes("expensive");

  const analyticsIntent =
    normalized.includes("analysis") ||
    normalized.includes("analyze") ||
    normalized.includes("portfolio") ||
    normalized.includes("landscape") ||
    normalized.includes("sector") ||
    normalized.includes("stage breakdown") ||
    normalized.includes("environment");

  const riskIntent =
    normalized.includes("risk") ||
    normalized.includes("safety") ||
    normalized.includes("review") ||
    normalized.includes("sensitive") ||
    normalized.includes("complexity") ||
    normalized.includes("coordination");

  return {
    cleaned,
    normalized,
    tokens: tokenizeQuery(normalized),
    city,
    state,
    country,
    stage,
    sector,
    constructionType,
    environmentHint,
    valueHint,
    analyticsIntent,
    riskIntent,
  };
}

function safeText(v: unknown) {
  return String(v ?? "").toLowerCase();
}

function numberValue(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sectorRoot(project: ProjectRow) {
  return String(project.primary_sector ?? "")
    .split(" --> ")[0]
    .trim() || "Unknown";
}

function normalizeStage(stage: string | null | undefined) {
  const s = safeText(stage);
  if (s.includes("execution")) return "Execution";
  if (s.includes("planning")) return "Planning";
  if (s.includes("design")) return "Design";
  if (s.includes("construction")) return "Construction";
  if (s.includes("preconstruction")) return "Preconstruction";
  if (s.includes("completed")) return "Completed";
  return stage || "Unknown";
}

function normalizeEnvironment(project: ProjectRow) {
  const locationType = safeText(project.location_type);

  if (locationType.includes("offshore")) return "Offshore";
  if (locationType.includes("onshore")) return "Onshore";

  const city = safeText(project.city);
  const state = safeText(project.state);

  if (city || state) return "Urban / terrestrial";
  return "General terrestrial";
}

function classifyValueBand(project: ProjectRow) {
  const value = numberValue(project.project_value_usd);
  if (value >= 1_000_000_000) return "Mega-project scale";
  if (value >= 250_000_000) return "Large-project scale";
  if (value >= 50_000_000) return "Mid-large project scale";
  if (value > 0) return "Smaller disclosed-value project";
  return "Undisclosed-value project";
}

function inferDynamicSignals(
  project: ProjectRow,
  companyCount: number,
  metricCount: number,
  subprojectCount: number
) {
  const sRoot = sectorRoot(project);
  const stage = normalizeStage(project.project_stage);
  const environment = normalizeEnvironment(project);
  const valueBand = classifyValueBand(project);

  const coordinationBurden =
    companyCount >= 12
      ? "High"
      : companyCount >= 6
      ? "Medium"
      : "Low";

  const systemDensity =
    metricCount >= 10
      ? "High"
      : metricCount >= 4
      ? "Medium"
      : "Low";

  const fragmentation =
    subprojectCount >= 8
      ? "High"
      : subprojectCount >= 3
      ? "Medium"
      : "Low";

  let reviewSensitivity = "Low";
  if (stage === "Execution" || stage === "Construction") reviewSensitivity = "High";
  else if (stage === "Planning" || stage === "Design" || stage === "Preconstruction")
    reviewSensitivity = "Medium";

  let complexity = "Moderate";
  const cType = safeText(project.construction_type);

  if (
    cType.includes("redevelopment") ||
    cType.includes("renovation") ||
    cType.includes("refurbishment")
  ) {
    complexity = "Existing-site complexity";
  } else if (
    cType.includes("new") ||
    cType.includes("expansion") ||
    cType.includes("mixed-use")
  ) {
    complexity = "New-build / expansion coordination";
  }

  const riskSignals: string[] = [];

  if (coordinationBurden === "High") {
    riskSignals.push(
      "Multi-party coordination burden is high, which can increase interface-management and handoff risk."
    );
  }

  if (fragmentation === "High") {
    riskSignals.push(
      "A high subproject count suggests program fragmentation and potentially more planning / sequencing overhead."
    );
  }

  if (systemDensity === "High") {
    riskSignals.push(
      "A dense operating-metrics profile suggests this context has many measurable systems, assets, or operational dimensions."
    );
  }

  if (reviewSensitivity === "High") {
    riskSignals.push(
      "Because the matched context is in an active delivery phase, review sensitivity is elevated."
    );
  }

  if (valueBand === "Mega-project scale" || valueBand === "Large-project scale") {
    riskSignals.push(
      "Scale appears large enough that escalation paths, stakeholder alignment, and reporting clarity matter more."
    );
  }

  const summary = [
    project.project_name || null,
    stage ? `${stage} stage` : null,
    [project.city, project.state, project.country].filter(Boolean).join(", ") || null,
    sRoot !== "Unknown" ? sRoot : null,
    project.construction_type || null,
    environment,
    valueBand,
  ]
    .filter(Boolean)
    .join(" • ");

  const insights = [
    `${environment} operating environment.`,
    `${complexity}.`,
    `Coordination burden appears ${coordinationBurden.toLowerCase()} based on linked-entity count.`,
    `System density appears ${systemDensity.toLowerCase()} based on the volume of structured metrics.`,
    `Program fragmentation appears ${fragmentation.toLowerCase()} based on sub-record count.`,
    `Review sensitivity is ${reviewSensitivity.toLowerCase()} based on stage.`,
    `Scale profile: ${valueBand.toLowerCase()}.`,
    ...riskSignals,
  ];

  return {
    sectorRoot: sRoot,
    coordinationBurden,
    reviewSensitivity,
    environment,
    complexity,
    systemDensity,
    fragmentation,
    valueBand,
    summary,
    insights,
  };
}

function scoreProject(row: ProjectRow, intent: ParsedIntent) {
  let score = 0;
  const reasons: string[] = [];

  const haystack = [
    safeText(row.project_name),
    safeText(row.city),
    safeText(row.state),
    safeText(row.country),
    safeText(row.primary_sector),
    safeText(row.construction_type),
    safeText(row.project_stage),
    safeText(row.location_type),
  ].join(" | ");

  if (intent.city && haystack.includes(intent.city)) {
    score += 40;
    reasons.push(`Strong location alignment on city: ${row.city}`);
  }

  if (intent.state && haystack.includes(intent.state)) {
    score += 28;
    reasons.push(`Matched state / province: ${row.state}`);
  }

  if (intent.country && haystack.includes(intent.country)) {
    score += 18;
    reasons.push(`Matched country: ${row.country}`);
  }

  if (intent.stage && haystack.includes(intent.stage)) {
    score += 30;
    reasons.push(`Strong stage alignment: ${row.project_stage}`);
  }

  if (intent.sector && haystack.includes(intent.sector)) {
    score += 36;
    reasons.push(`Strong sector alignment: ${intent.sector}`);
  }

  if (intent.constructionType && haystack.includes(intent.constructionType)) {
    score += 28;
    reasons.push(`Matched context-type signal: ${row.construction_type}`);
  }

  if (intent.environmentHint) {
    if (
      (intent.environmentHint === "offshore" && safeText(row.location_type).includes("offshore")) ||
      (intent.environmentHint === "onshore" && safeText(row.location_type).includes("onshore"))
    ) {
      score += 16;
      reasons.push(`Matched environment hint: ${intent.environmentHint}`);
    }
  }

  let tokenHits = 0;
  for (const token of intent.tokens) {
    if (haystack.includes(token)) tokenHits += 1;
  }

  if (tokenHits > 0) {
    score += tokenHits * 8;
    reasons.push(`Matched ${tokenHits} keyword${tokenHits === 1 ? "" : "s"} from the prompt`);
  }

  if (intent.valueHint && row.project_value_usd) {
    score += 12;
    reasons.push("Boosted for value / scale-oriented query intent");
  }

  const value = numberValue(row.project_value_usd);
  if (value >= 1_000_000_000) score += 6;
  else if (value >= 250_000_000) score += 4;
  else if (value >= 50_000_000) score += 2;

  if (intent.analyticsIntent) {
    score += 4;
  }

  if (intent.riskIntent) {
    score += 4;
  }

  return { score, reasons };
}

function confidenceLabel(score: number) {
  if (score >= 90) return "high";
  if (score >= 55) return "medium";
  if (score >= 25) return "low";
  return "weak";
}

function topCount<T extends Record<string, any>>(rows: T[], key: keyof T, n = 3) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const v = String(row[key] ?? "").trim() || "Unknown";
    counts.set(v, (counts.get(v) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));
}

function buildPortfolioAnalytics(matches: any[]) {
  return {
    totalMatchesConsidered: matches.length,
    topStages: topCount(matches, "project_stage", 3),
    topConstructionTypes: topCount(matches, "construction_type", 3),
    topCountries: topCount(matches, "country", 3),
    topSectorRoots: topCount(
      matches.map((m) => ({ sectorRoot: sectorRoot(m) })),
      "sectorRoot",
      3
    ),
    averageProjectValueUsd:
      matches.length > 0
        ? Math.round(
            matches.reduce((sum, m) => sum + numberValue(m.project_value_usd), 0) /
              matches.length
          )
        : 0,
  };
}

function buildContextSummary(
  project: ProjectRow,
  inferred: any,
  companyCount: number,
  metricCount: number,
  subprojectCount: number,
  intent: ParsedIntent
) {
  const parts = [
    project.project_name ? `${project.project_name} is the strongest current match.` : null,
    inferred?.summary || null,
    companyCount
      ? `${companyCount} linked entit${companyCount === 1 ? "y" : "ies"} indicate ${String(
          inferred?.coordinationBurden || "meaningful"
        ).toLowerCase()} coordination complexity.`
      : null,
    metricCount
      ? `${metricCount} structured metric${metricCount === 1 ? "" : "s"} add additional system-level context.`
      : null,
    subprojectCount
      ? `${subprojectCount} sub-record${subprojectCount === 1 ? "" : "s"} suggest additional layering beneath the parent record.`
      : null,
    inferred?.reviewSensitivity
      ? `Review sensitivity is inferred as ${String(inferred.reviewSensitivity).toLowerCase()}.`
      : null,
    intent.valueHint
      ? `Because the prompt emphasized value or scale, higher-value records were weighted more strongly during ranking.`
      : null,
    intent.analyticsIntent
      ? `The response is optimized for broad context interpretation, not just exact keyword matching.`
      : null,
  ];

  return parts.filter(Boolean).join(" ");
}

export async function GET(req: NextRequest) {
  const rawQ = req.nextUrl.searchParams.get("q")?.trim();

  if (!rawQ) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  try {
    const { db } = await import("@/lib/db");

    const intent = parseIntent(rawQ);

    const candidateRes = await db.query(
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
      order by project_value_usd desc nulls last
      limit 800
      `
    );

    const candidates: ProjectRow[] = candidateRes.rows || [];

    if (candidates.length === 0) {
      return NextResponse.json({
        found: false,
        query: rawQ,
        interpretedQuery: intent,
        confidence: "weak",
        message: "No structured context records are currently available in the dataset.",
        matches: [],
      });
    }

    const ranked = candidates
      .map((row) => {
        const { score, reasons } = scoreProject(row, intent);
        return { ...row, _score: score, _reasons: reasons };
      })
      .sort((a: any, b: any) => {
        if (b._score !== a._score) return b._score - a._score;
        return numberValue(b.project_value_usd) - numberValue(a.project_value_usd);
      });

    const finalMatches = ranked.slice(0, 10);
    const topProject = finalMatches[0];

    if (!topProject) {
      return NextResponse.json({
        found: false,
        query: rawQ,
        interpretedQuery: intent,
        confidence: "weak",
        message: `No matching structured context found for "${rawQ}".`,
        matches: [],
      });
    }

    const [locationsRes, metricsRes, companiesRes, subprojectsRes] = await Promise.all([
      db.query(
        `
        select city, state, country, latitude, longitude, project_post_code, is_primary
        from project_locations
        where project_id = $1
        order by sort_order asc nulls last
        limit 25
        `,
        [topProject.project_id]
      ),
      db.query(
        `
        select facility_type, parameter, unit_value, unit_name, product_name
        from project_operating_metrics
        where project_id = $1
        order by parameter asc
        limit 25
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
        limit 25
        `,
        [topProject.project_id]
      ),
      db.query(
        `
        select sub_project_id, sub_project_name
        from project_subprojects
        where parent_project_id = $1
        limit 25
        `,
        [topProject.project_id]
      ),
    ]);

    const companyCount = companiesRes.rows.length;
    const metricCount = metricsRes.rows.length;
    const subprojectCount = subprojectsRes.rows.length;

    const inferred = inferDynamicSignals(
      topProject,
      companyCount,
      metricCount,
      subprojectCount
    );

    const confidence = confidenceLabel(topProject._score);
    const portfolioAnalytics = buildPortfolioAnalytics(finalMatches);

    const matchExplanation = [
      ...(topProject._reasons || []),
      `Query interpreted as: ${
        [
          intent.city && `city=${intent.city}`,
          intent.state && `state=${intent.state}`,
          intent.country && `country=${intent.country}`,
          intent.stage && `stage=${intent.stage}`,
          intent.sector && `sector=${intent.sector}`,
          intent.constructionType && `type=${intent.constructionType}`,
          intent.environmentHint && `environment=${intent.environmentHint}`,
          intent.valueHint && `value-focus=true`,
        ]
          .filter(Boolean)
          .join(", ") || "broad context inference"
      }`,
    ];

    const projectContext = {
      project: topProject,
      locations: locationsRes.rows,
      metrics: metricsRes.rows,
      companies: companiesRes.rows,
      subprojects: subprojectsRes.rows,
      inferred: {
        ...inferred,
        summary: buildContextSummary(
          topProject,
          inferred,
          companyCount,
          metricCount,
          subprojectCount,
          intent
        ),
      },
      analytics: {
        portfolio: portfolioAnalytics,
        valueBand: inferred.valueBand,
        systemDensity: inferred.systemDensity,
        fragmentation: inferred.fragmentation,
      },
    };

    return NextResponse.json({
      found: true,
      query: rawQ,
      interpretedQuery: intent,
      confidence,
      topMatch: {
        ...topProject,
        matchScore: topProject._score,
        matchReasons: topProject._reasons,
      },
      matches: finalMatches.map(({ _score, _reasons, ...rest }: any) => ({
        ...rest,
        matchScore: _score,
        matchReasons: _reasons,
      })),
      matchExplanation,
      projectContext,
    });
  } catch (error: any) {
    console.error("chat-context error:", error);

    return NextResponse.json(
      {
        found: false,
        fallback: true,
        query: rawQ,
        message:
          "Structured context is temporarily unavailable. Using general aviation intelligence context instead.",
        error: String(error?.message || error),
        matches: [],
        projectContext: null,
      },
      { status: 500 }
    );
  }
}
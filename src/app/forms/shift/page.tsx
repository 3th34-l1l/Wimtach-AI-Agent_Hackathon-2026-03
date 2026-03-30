"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Button } from "@/src/app/components/ui/Button";
import { useAppState } from "@/src/app/components/state/AppState";
import {
  AlertTriangle,
  Building2,
  FileSearch,
  MessageSquareText,
  ShieldCheck,
  UserCheck,
  Clock3,
  Link2,
  CheckCircle2,
  Upload,
  FileUp,
  Mail,
  Smartphone,
} from "lucide-react";

type ActionStatus = "Open" | "In Review" | "Assigned" | "Closed";

type CoordinationMessage = {
  id: string;
  author: string;
  createdAt: number;
  text: string;
  sourceChannel?: "web" | "email" | "sms" | "upload";
  projectId?: string | number;
};

type InterventionItem = {
  id: string;
  title: string;
  why: string;
  owner: string;
  due: string;
  status: ActionStatus;
};

type UploadSuggestion = {
  projectId: string | number;
  projectName: string;
  location?: string;
  reason?: string;
};

type UploadResponse = {
  ok: boolean;
  detectedType: string;
  detectedUse: string;
  confidence: string;
  summary: {
    rows: number;
    columns: number;
    detectedType: string;
    confidence: string;
  };
  columns: string[];
  possibleProjectLinks: UploadSuggestion[];
  whyThisMatters: string[];
  rows: Record<string, any>[];
};

type ThreadSummary = {
  count: number;
  channels: string[];
  linkedProject: null | {
    projectId?: string | number;
    projectName?: string;
  };
  linkedUpload: null | {
    uploadId?: string;
    uploadName?: string;
    detectedType?: string;
  };
};

type ThreadResponse = {
  ok: boolean;
  summary: ThreadSummary;
  messages: Array<{
    id: string;
    createdAt: number;
    from: string;
    text: string;
    sourceChannel?: "web" | "email" | "sms" | "upload";
    linkedContext?: {
      projectId?: string | number;
      projectName?: string;
      uploadId?: string;
      uploadName?: string;
      detectedType?: string;
    };
  }>;
};

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

async function fetchCoordinationThread(projectId?: string | number | null, uploadId?: string | null) {
  const qs = new URLSearchParams();
  qs.set("scope", "review_thread");

  if (projectId !== null && projectId !== undefined) {
    qs.set("projectId", String(projectId));
  }

  if (uploadId) {
    qs.set("uploadId", uploadId);
  }

  const r = await fetch(`/api/team-chat?${qs.toString()}`);
  const data = (await r.json().catch(() => ({}))) as ThreadResponse;

  if (!r.ok) {
    throw new Error("Failed to load coordination thread");
  }

  return data;
}

async function postCoordinationMessage(payload: {
  text: string;
  from: string;
  sourceChannel?: "web" | "email" | "sms" | "upload";
  projectId?: string | number | null;
  projectName?: string | null;
  uploadId?: string | null;
  uploadName?: string | null;
  detectedType?: string | null;
}) {
  const r = await fetch("/api/team-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: "review_thread",
      from: payload.from,
      text: payload.text,
      sourceChannel: payload.sourceChannel || "web",
      linkedContext: {
        projectId: payload.projectId ?? undefined,
        projectName: payload.projectName ?? undefined,
        uploadId: payload.uploadId ?? undefined,
        uploadName: payload.uploadName ?? undefined,
        detectedType: payload.detectedType ?? undefined,
      },
    }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.error || "Failed to send coordination message");
  }

  return data;
}

export default function ShiftReportPage() {
  const {
    selectedForm,
    projectId,
    projectName,
    projectSummary,
    projectStage,
    projectLocation,
    sectorRoot,
    coordinationBurden,
    reviewSensitivity,
    environment,
    complexity,
    projectInsights,
    projectCompanies,
    projectMetrics,
  } = useAppState();

  const [reviewArea, setReviewArea] = useState("Team Bravo / Electrical Coordination");
  const [question, setQuestion] = useState("");
  const [analystAnswer, setAnalystAnswer] = useState(
    "Ask about what this context means, what should be reviewed next, or how to communicate the issue to a safety committee."
  );

  const [threadInput, setThreadInput] = useState("");
  const [thread, setThread] = useState<CoordinationMessage[]>([]);
  const [threadSummary, setThreadSummary] = useState<ThreadSummary>({
    count: 0,
    channels: [],
    linkedProject: null,
    linkedUpload: null,
  });
  const [threadLoading, setThreadLoading] = useState(false);

  const [actions, setActions] = useState<InterventionItem[]>([
    {
      id: uid(),
      title: "Review contractor coordination exposure",
      why: "Project context suggests higher coordination complexity based on linked companies.",
      owner: "Site Supervisor",
      due: "Next toolbox talk",
      status: "Assigned",
    },
    {
      id: uid(),
      title: "Confirm review priority with committee",
      why: "Execution-stage work is being treated as more review-sensitive in the current context.",
      owner: "Safety Coordinator",
      due: "This week",
      status: "Open",
    },
  ]);

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [linkedUploadId, setLinkedUploadId] = useState<string | null>(null);
  const [linkedUploadName, setLinkedUploadName] = useState<string | null>(null);

  const [reviewStatus, setReviewStatus] = useState<"idle" | "sending" | "sent">("idle");

  const supportLabel = useMemo(() => {
    const f = (selectedForm || "").toLowerCase();
    if (f.includes("source")) return "Level 1–2 emphasized";
    if (f.includes("trend")) return "Level 2–3 emphasized";
    if (f.includes("summary")) return "Mixed support view";
    if (f.includes("incident")) return "Pending source mapping";
    return "Context-driven support";
  }, [selectedForm]);

  const linkedCompanyCount = projectCompanies?.length || 0;
  const topCompanies = (projectCompanies || []).slice(0, 5);
  const topMetrics = (projectMetrics || []).slice(0, 5);

  useEffect(() => {
    let cancelled = false;

    async function loadThread() {
      try {
        setThreadLoading(true);
        const data = await fetchCoordinationThread(projectId, linkedUploadId);

        if (cancelled) return;

        setThread(
          (data.messages || []).map((m) => ({
            id: m.id,
            author: m.from,
            createdAt: m.createdAt,
            text: m.text,
            sourceChannel: m.sourceChannel,
            projectId: m.linkedContext?.projectId,
          }))
        );
        setThreadSummary(
          data.summary || {
            count: 0,
            channels: [],
            linkedProject: null,
            linkedUpload: null,
          }
        );
      } catch {
        if (!cancelled) {
          setThread([]);
        }
      } finally {
        if (!cancelled) setThreadLoading(false);
      }
    }

    loadThread();

    return () => {
      cancelled = true;
    };
  }, [projectId, linkedUploadId]);

  function askAnalyst() {
    const q = question.trim();
    if (!q) return;

    const answer = [
      `Current context is ${coordinationBurden || "undetermined"} coordination and ${reviewSensitivity || "undetermined"} review sensitivity.`,
      projectSummary ? `Project summary: ${projectSummary}` : null,
      uploadResult?.detectedUse
        ? `Uploaded context is currently being treated as ${uploadResult.detectedUse}.`
        : null,
      q.toLowerCase().includes("why")
        ? `This context is being prioritized because the matched project is ${
            projectStage ? `${projectStage.toLowerCase()} stage` : "currently active"
          } and linked to ${linkedCompanyCount} company records.`
        : null,
      q.toLowerCase().includes("next")
        ? `Recommended next step: assign a reviewer, clarify what needs confirmation, and capture whether this is a contextual concern or an observed field issue.`
        : null,
      `These are decision-support signals, not confirmed safety findings.`,
    ]
      .filter(Boolean)
      .join(" ");

    setAnalystAnswer(answer);
    setQuestion("");
  }

  async function sendThreadMessage() {
    const text = threadInput.trim();
    if (!text) return;

    try {
      const data = await postCoordinationMessage({
        text,
        from: "You",
        sourceChannel: "web",
        projectId,
        projectName,
        uploadId: linkedUploadId,
        uploadName: linkedUploadName,
        detectedType: uploadResult?.detectedType || null,
      });

      const saved = data?.message;
      if (saved) {
        setThread((prev) => [
          ...prev,
          {
            id: saved.id,
            author: saved.from,
            createdAt: saved.createdAt,
            text: saved.text,
            sourceChannel: saved.sourceChannel,
            projectId: saved.linkedContext?.projectId,
          },
        ]);
      }

      setThreadInput("");
    } catch {
      setThreadInput((prev) => prev || "Could not send message");
    }
  }

  function updateActionStatus(id: string, status: ActionStatus) {
    setActions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const r = await fetch("/api/upload-shift", {
        method: "POST",
        body: formData,
      });

      const data = (await r.json().catch(() => ({}))) as UploadResponse;

      if (!r.ok || !data?.ok) {
        throw new Error("Upload failed");
      }

      setUploadResult(data);

      const uploadId = uid();
      setLinkedUploadId(uploadId);
      setLinkedUploadName(file.name);

      const topMatch = data.possibleProjectLinks?.[0];

      await postCoordinationMessage({
        from: "Safety Tracker",
        text: topMatch
          ? `Uploaded file "${file.name}" was classified as ${data.detectedUse} and may relate to project "${topMatch.projectName}".`
          : `Uploaded file "${file.name}" was classified as ${data.detectedUse}.`,
        sourceChannel: "upload",
        projectId: topMatch?.projectId ?? projectId ?? null,
        projectName: topMatch?.projectName ?? projectName ?? null,
        uploadId,
        uploadName: file.name,
        detectedType: data.detectedType,
      });
    } catch {
      setUploadResult(null);
    } finally {
      setUploading(false);
    }
  }

  function buildReviewExplanation() {
    const lines = [
      projectName ? `Best matched project: ${projectName}.` : null,
      projectSummary ? `Context summary: ${projectSummary}` : null,
      projectStage
        ? `The project appears to be in ${String(projectStage).toLowerCase()} stage.`
        : null,
      coordinationBurden
        ? `Coordination complexity is being treated as ${String(coordinationBurden).toLowerCase()}.`
        : null,
      reviewSensitivity
        ? `Review sensitivity is being treated as ${String(reviewSensitivity).toLowerCase()}.`
        : null,
      linkedCompanyCount
        ? `The current context includes ${linkedCompanyCount} linked company records.`
        : null,
      uploadResult?.detectedUse
        ? `The uploaded file is being treated as ${uploadResult.detectedUse}.`
        : null,
      uploadResult?.whyThisMatters?.length
        ? `Why the uploaded file matters: ${uploadResult.whyThisMatters.join(" ")}`
        : null,
      `These are contextual decision-support signals, not confirmed safety findings.`,
    ];

    return lines.filter(Boolean).join(" ");
  }

  async function submitForReview() {
    try {
      setReviewStatus("sending");

      const payload = {
        adminEmail: "Team10@ConstructMatrix.net",
        submittedAt: new Date().toISOString(),
        sourceChannel: "web",
        projectContext: {
          projectId,
          projectName,
          projectStage,
          projectLocation,
          sectorRoot,
          coordinationBurden,
          reviewSensitivity,
          environment,
          complexity,
        },
        uploadContext: uploadResult
          ? {
              uploadId: linkedUploadId,
              uploadName: linkedUploadName,
              detectedType: uploadResult.detectedType,
              detectedUse: uploadResult.detectedUse,
            }
          : {},
        threadSummary,
        aiExplanation: buildReviewExplanation(),
        summary:
          "This submission brings together matched project context, uploaded supporting context, coordination discussion, and assigned intervention items for reviewer approval.",
        pendingChanges: actions,
      };

      const r = await fetch("/api/schedule-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.error || "Review submission failed");
      }

      setReviewStatus("sent");
    } catch {
      setReviewStatus("idle");
    }
  }

  return (
    <AppShell>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Intervention & Coordination Hub</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Turn interpreted project context into coordinated safety review, uploaded supporting context, assigned actions, and committee-ready follow-up.
            </p>
          </div>

          <div className="rounded-2xl bg-black/30 px-3 py-2 text-xs text-zinc-300 shadow-inner">
            <span className="text-zinc-500">Mode:</span>{" "}
            <span className="font-semibold text-sky-300">
              {selectedForm || "Context Review"}
            </span>
            <span className="mx-2 text-zinc-600">•</span>
            <span className="text-zinc-500">Coordination:</span>{" "}
            <span className="text-amber-300">{coordinationBurden || "—"}</span>
            <span className="mx-2 text-zinc-600">•</span>
            <span className="text-zinc-500">Sensitivity:</span>{" "}
            <span className="text-red-300">{reviewSensitivity || "—"}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* LEFT */}
          <div className="space-y-5 lg:col-span-1">
            <SectionCard
              icon={<Link2 className="h-4 w-4" />}
              title="Linked Project Context"
              subtitle="This is the current project context driving review."
            >
              <Detail label="Best Match" value={projectName || "No project matched yet"} />
              <Detail label="Location" value={projectLocation || "—"} />
              <Detail label="Stage" value={projectStage || "—"} />
              <Detail label="Sector" value={sectorRoot || "—"} />
              <Detail label="Environment" value={environment || "—"} />
              <Detail label="Complexity" value={complexity || "—"} />
            </SectionCard>

            <SectionCard
              icon={<FileUp className="h-4 w-4" />}
              title="Upload Context File"
              subtitle="Add a spreadsheet or export that may help explain project, workforce, contractor, or safety context."
            >
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleUpload}
                className="text-sm text-zinc-300"
              />

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-1">
                  <Upload className="h-3.5 w-3.5" />
                  Web Upload
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-1">
                  <Mail className="h-3.5 w-3.5" />
                  Email-ready
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-1">
                  <Smartphone className="h-3.5 w-3.5" />
                  SMS-ready
                </span>
              </div>

              {uploading && (
                <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm text-zinc-300 shadow-inner">
                  Uploading and classifying context file...
                </div>
              )}

              {uploadResult && (
                <div className="mt-4 space-y-3">
                  <Detail
                    label="Detected Use"
                    value={`${uploadResult.detectedUse} (${uploadResult.confidence} confidence)`}
                  />
                  <Detail
                    label="Summary"
                    value={`${uploadResult.summary.rows} rows • ${uploadResult.summary.columns} columns • ${uploadResult.detectedType}`}
                  />
                  <Detail
                    label="Why This Matters"
                    value={uploadResult.whyThisMatters.join(" ")}
                  />
                  <Detail
                    label="Possible Project Links"
                    value={
                      uploadResult.possibleProjectLinks?.length
                        ? uploadResult.possibleProjectLinks
                            .map((p) => `${p.projectName}${p.location ? ` • ${p.location}` : ""}`)
                            .join(" | ")
                        : "No likely project links detected."
                    }
                  />
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={<UserCheck className="h-4 w-4" />}
              title="Crew / Area Under Review"
              subtitle="Use this to frame who or what the committee is reviewing."
            >
              <input
                value={reviewArea}
                onChange={(e) => setReviewArea(e.target.value)}
                className="w-full rounded-xl bg-black/30 px-4 py-3 text-sm text-white outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
              />
              <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm text-zinc-300 shadow-inner">
                This review is currently framed around:{" "}
                <span className="font-semibold text-zinc-100">{reviewArea}</span>
              </div>
            </SectionCard>

            <SectionCard
              icon={<FileSearch className="h-4 w-4" />}
              title="Ask Safety Analyst"
              subtitle="Ask what this context means or what should happen next."
            >
              <div className="space-y-3">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Why is this context being treated as higher priority?"
                  className="w-full rounded-xl bg-black/30 px-4 py-3 text-sm text-white outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") askAnalyst();
                  }}
                />
                <Button variant="primary" onClick={askAnalyst}>
                  Ask Analyst
                </Button>
              </div>

              <div className="mt-4 rounded-2xl bg-black/30 p-4 text-sm text-zinc-200 shadow-inner">
                {analystAnswer}
              </div>
            </SectionCard>
          </div>

          {/* MIDDLE */}
          <div className="space-y-5 lg:col-span-1">
            <SectionCard
              icon={<MessageSquareText className="h-4 w-4" />}
              title="Safety Coordination Thread"
              subtitle="A lightweight collaboration stream for committee and supervisor follow-up."
            >
              <div className="mb-3 rounded-2xl bg-black/30 p-3 text-sm text-zinc-300 shadow-inner">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                  Linked Context
                </div>
                <div className="mt-1 text-zinc-100">
                  {threadSummary.linkedProject?.projectName || projectName || "No linked project context"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Channels: {threadSummary.channels?.length ? threadSummary.channels.join(", ") : "—"}
                  {" • "}
                  Messages: {threadSummary.count ?? 0}
                </div>
                {threadSummary.linkedUpload?.uploadName && (
                  <div className="mt-1 text-xs text-zinc-400">
                    Upload: {threadSummary.linkedUpload.uploadName} • {threadSummary.linkedUpload.detectedType || "unknown"}
                  </div>
                )}
              </div>

              <div className="max-h-[280px] space-y-2 overflow-auto rounded-2xl bg-black/30 p-3 shadow-inner">
                {threadLoading ? (
                  <div className="text-sm text-zinc-400">Loading thread...</div>
                ) : thread.length ? (
                  thread.map((m) => (
                    <div key={m.id} className="rounded-2xl bg-white/5 px-3 py-2 text-sm text-zinc-200">
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <span>
                          {m.author}
                          {m.sourceChannel ? ` • ${String(m.sourceChannel).toUpperCase()}` : ""}
                        </span>
                        <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="mt-1">{m.text}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-400">No coordination messages yet.</div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  value={threadInput}
                  onChange={(e) => setThreadInput(e.target.value)}
                  placeholder="Add a coordination note or committee comment..."
                  className="h-11 flex-1 rounded-2xl bg-black/30 px-4 text-sm text-zinc-100 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendThreadMessage();
                  }}
                />
                <Button variant="primary" onClick={sendThreadMessage}>
                  Send
                </Button>
              </div>
            </SectionCard>

            <SectionCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Intervention Tracker"
              subtitle="This is the accountability layer missing from many current workflows."
            >
              <div className="space-y-3">
                {actions.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-black/30 p-3 shadow-inner"
                  >
                    <div className="font-semibold text-zinc-100">{item.title}</div>
                    <div className="mt-1 text-sm text-zinc-400">{item.why}</div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-zinc-400">
                      <div>
                        <span className="text-zinc-500">Owner:</span> {item.owner}
                      </div>
                      <div>
                        <span className="text-zinc-500">Due:</span> {item.due}
                      </div>
                    </div>

                    <div className="mt-3">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          updateActionStatus(item.id, e.target.value as ActionStatus)
                        }
                        className="h-9 rounded-xl bg-white/5 px-3 text-xs text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                      >
                        <option>Open</option>
                        <option>In Review</option>
                        <option>Assigned</option>
                        <option>Closed</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* RIGHT */}
          <div className="space-y-5 lg:col-span-1">
            <SectionCard
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Review Signals"
              subtitle="Plain-language signals derived from the matched project context."
            >
              <Detail label="Context Summary" value={projectSummary || "No summary yet"} />
              <Detail
                label="Why This Matters"
                value={
                  projectInsights?.length
                    ? projectInsights.join(" ")
                    : "No interpreted signals yet."
                }
              />
              <Detail
                label="Important Note"
                value="These are contextual decision-support signals, not confirmed safety findings."
              />
            </SectionCard>

            <SectionCard
              icon={<Building2 className="h-4 w-4" />}
              title="Linked Companies"
              subtitle="Used to help explain coordination complexity."
            >
              {topCompanies.length ? (
                <div className="space-y-2">
                  {topCompanies.map((c, i) => (
                    <div key={i} className="rounded-xl bg-black/30 px-3 py-2 text-sm text-zinc-200 shadow-inner">
                      <div className="font-medium">{c.company_name}</div>
                      <div className="text-xs text-zinc-500">
                        {[c.industry, c.country, c.company_ticker].filter(Boolean).join(" • ") || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="No linked companies shown yet." />
              )}
            </SectionCard>

            <SectionCard
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Source Support"
              subtitle="Keeps the source-ladder framing visible in context."
            >
              <Detail label="Support View" value={supportLabel} />
              <Detail
                label="Source Ladder Note"
                value="Higher-authority sources should anchor interpretation where possible. Lower-authority sources may still help explain context, but should not be treated the same way."
              />
            </SectionCard>

            <SectionCard
              icon={<Clock3 className="h-4 w-4" />}
              title="Top Metrics / Next Step"
              subtitle="Useful follow-up prompts for a supervisor or committee."
            >
              {topMetrics.length ? (
                <div className="space-y-2">
                  {topMetrics.map((m, i) => (
                    <div key={i} className="rounded-xl bg-black/30 px-3 py-2 text-sm text-zinc-200 shadow-inner">
                      <div className="font-medium">{m.parameter || "Unknown metric"}</div>
                      <div className="text-xs text-zinc-500">
                        {[m.facility_type, m.unit_value, m.unit_name].filter(Boolean).join(" • ") || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="No project metrics shown yet." />
              )}

              <div className="mt-4 rounded-2xl bg-black/30 p-3 text-sm text-zinc-300 shadow-inner">
                Recommended next step: confirm whether this is only contextual concern or an observed field issue, assign an owner, and document follow-up in the intervention tracker.
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="primary"
                  onClick={submitForReview}
                  disabled={reviewStatus === "sending"}
                >
                  {reviewStatus === "sending"
                    ? "Submitting..."
                    : reviewStatus === "sent"
                    ? "Submitted"
                    : "Submit for Review"}
                </Button>
              </div>
            </SectionCard>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-black/30 text-zinc-200">
          {icon}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-zinc-400">{title}</div>
          <div className="mt-1 text-xs text-zinc-500">{subtitle}</div>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/30 px-3 py-3 text-sm text-zinc-200 shadow-inner">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 break-words">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-black/30 px-3 py-3 text-sm text-zinc-400 shadow-inner">
      {text}
    </div>
  );
}
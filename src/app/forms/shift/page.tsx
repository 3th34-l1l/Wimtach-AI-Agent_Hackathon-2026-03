/* ===========================
FILE: /app/forms/shift/page.tsx
Form 3 — Shift Report (Phase 2 + Members + Team Chat)
✅ Persistent team/dm chat via /api/team-chat (JSON store)
✅ Correct swap logic (stable row IDs, not filtered indexes)
✅ Fatigue flags mapped by row ID
✅ Click date to link shift into chat
✅ Proposed changes + Submit for Approval (emails admin)
✅ Download updated CSV
=========================== */

"use client";
import React, { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Button } from "@/src/app/components/ui/Button";
import { useAppState } from "@/src/app/components/state/AppState";

type ShiftRow = {
  date?: string; // YYYY-MM-DD
  start?: string; // HH:MM
  end?: string; // HH:MM
  unit?: string;
  team?: string;
};

type ShiftRowWithId = ShiftRow & { _id: string };

const ADMIN_EMAIL = "Team10@EffectiveAI.net";

type PendingChange = {
  id: string;
  kind: "swap" | "edit";
  createdAt: number;
  note?: string;
  before?: ShiftRow;
  after?: ShiftRow;
};

type Member = { id: string; name: string; team: string; role: "Medic" | "Supervisor" | "Admin" };

type ChatMsg = {
  id: string;
  createdAt: number;
  scope: "team" | "dm";
  team?: string;
  toMemberId?: string;
  from: string; // "You" for now
  text: string;
  linkedShift?: ShiftRow;
};

async function fetchChat(scope: "team" | "dm", team: string, toMemberId: string) {
  const params =
    scope === "team"
      ? `scope=team&team=${encodeURIComponent(team)}`
      : `scope=dm&toMemberId=${encodeURIComponent(toMemberId)}`;

  const r = await fetch(`/api/team-chat?${params}`, { method: "GET" });
  const data = await r.json().catch(() => ({}));
  return (data?.messages || []) as ChatMsg[];
}

async function postChat(msg: ChatMsg) {
  const r = await fetch("/api/team-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) throw new Error(data?.error || "Chat send failed");
  return data.message as ChatMsg;
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function norm(s: any) {
  return String(s ?? "").trim();
}

function isValidISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function toDateObj(d: string) {
  const [y, m, day] = String(d || "").split("-").map((x) => Number(x));
  if (!y || !m || !day) return null;
  return new Date(y, m - 1, day);
}

function fmtDayLabel(d: string) {
  const dt = toDateObj(d);
  if (!dt) return d || "—";
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function monthKey(d: string) {
  if (!isValidISODate(d)) return "Unknown";
  return d.slice(0, 7);
}

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function inNextDays(dateISO: string, days: number) {
  const t = toDateObj(todayISO());
  const x = toDateObj(dateISO);
  if (!t || !x) return false;
  const diff = (x.getTime() - t.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

function hhmmToMinutes(t: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function restHours(prev: ShiftRow, next: ShiftRow) {
  if (!prev.date || !next.date) return null;
  const prevEnd = hhmmToMinutes(prev.end || "");
  const nextStart = hhmmToMinutes(next.start || "");
  if (prevEnd == null || nextStart == null) return null;

  const d1 = toDateObj(prev.date);
  const d2 = toDateObj(next.date);
  if (!d1 || !d2) return null;

  const dayDiff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  const minutesBetween = dayDiff * 24 * 60 + (nextStart - prevEnd);
  return minutesBetween / 60;
}

function toCSV(rows: ShiftRow[]) {
  const headers: (keyof ShiftRow)[] = ["date", "start", "end", "unit", "team"];
  const esc = (v: any) => `"${String(v ?? "").replaceAll(`"`, `""`)}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc((r as any)[h])).join(","))].join("\n");
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Stable id based on row content (good enough for hackathon)
function rowId(r: ShiftRow) {
  return `${norm(r.date)}|${norm(r.start)}|${norm(r.end)}|${norm(r.unit)}|${norm(r.team)}` || uid();
}

export default function ShiftReportPage() {
  const { setShiftSchedule, shiftSchedule } = useAppState();

  // ✅ Mock roster
  const [members] = useState<Member[]>([
    { id: "m1", name: "Alex Rivera", team: "Bravo", role: "Medic" },
    { id: "m2", name: "Sam Chen", team: "Bravo", role: "Medic" },
    { id: "m3", name: "Jordan Patel", team: "Charlie", role: "Medic" },
    { id: "m4", name: "Taylor Singh", team: "Charlie", role: "Medic" },
    { id: "m5", name: "Morgan Lee", team: "Alpha", role: "Supervisor" },
    { id: "m6", name: "Admin — Team10", team: "Admin", role: "Admin" },
  ]);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string>("—");
  const [schedule, setSchedule] = useState<ShiftRowWithId[]>(
    (shiftSchedule ?? []).map((r) => ({ ...r, _id: uid() }))
  );
  const [loading, setLoading] = useState(false);

  // Filters
  const [q, setQ] = useState("");
  const [month, setMonth] = useState<string>("all");
  const [unit, setUnit] = useState<string>("all");
  const [next14, setNext14] = useState<boolean>(false);

  // Swap + approval
  const [swapPick, setSwapPick] = useState<{ rowId: string; row: ShiftRowWithId } | null>(null);
  const [pending, setPending] = useState<PendingChange[]>([]);
  const [approvalStatus, setApprovalStatus] = useState<"idle" | "sending" | "sent">("idle");

  // Chat
  const [chatScope, setChatScope] = useState<"team" | "dm">("team");
  const [activeTeam, setActiveTeam] = useState<string>("Bravo");
  const [dmTo, setDmTo] = useState<string>("m1");
  const [chatInput, setChatInput] = useState("");
  const [linkedShift, setLinkedShift] = useState<ShiftRow | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);

  const tISO = todayISO();

  // Load persisted chat whenever room changes
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const msgs = await fetchChat(chatScope, activeTeam, dmTo);
        if (!cancelled) setChat(msgs);
      } catch {
        // ignore for hackathon
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatScope, activeTeam, dmTo]);

  const normalized = useMemo(() => {
    const rows = (schedule ?? []).map((r) => ({
      ...r,
      date: norm(r.date),
      start: norm(r.start),
      end: norm(r.end),
      unit: norm(r.unit),
      team: norm(r.team),
      _id: r._id || uid(),
    }));

    rows.sort((a, b) => {
      const ad = a.date || "";
      const bd = b.date || "";
      if (ad !== bd) return ad.localeCompare(bd);
      return (a.start || "").localeCompare(b.start || "");
    });

    return rows;
  }, [schedule]);

  // Fatigue mapped to row id (rest before THIS shift)
  const fatigueById = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 1; i < normalized.length; i++) {
      const prev = normalized[i - 1];
      const next = normalized[i];
      const h = restHours(prev, next);
      if (h != null) map.set(next._id, h);
    }
    return map;
  }, [normalized]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    normalized.forEach((r) => set.add(monthKey(r.date || "")));
    return Array.from(set).filter(Boolean).sort();
  }, [normalized]);

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    normalized.forEach((r) => r.unit && set.add(r.unit));
    return Array.from(set).sort();
  }, [normalized]);

  const teamOptions = useMemo(() => {
    const set = new Set<string>();
    normalized.forEach((r) => r.team && set.add(r.team));
    ["Alpha", "Bravo", "Charlie"].forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [normalized]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return normalized.filter((r) => {
      if (month !== "all" && monthKey(r.date || "") !== month) return false;
      if (unit !== "all" && (r.unit || "") !== unit) return false;
      if (next14 && !inNextDays(r.date || "", 14)) return false;
      if (!query) return true;
      return `${r.date} ${r.start} ${r.end} ${r.unit} ${r.team}`.toLowerCase().includes(query);
    });
  }, [normalized, q, month, unit, next14]);

  const summary = useMemo(() => {
    const total = normalized.length;
    const shown = filtered.length;
    const upcoming = normalized.filter((r) => inNextDays(r.date || "", 14)).length;
    const todayCount = normalized.filter((r) => r.date === tISO).length;
    let fatigues = 0;
    for (const [, h] of fatigueById) if (h < 10) fatigues++;
    return { total, shown, upcoming, todayCount, fatigues };
  }, [normalized, filtered, tISO, fatigueById]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;

    const formData = new FormData();
    formData.append("file", e.target.files[0]);

    const res = await fetch("/api/upload-shift", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));
    const rows = (data?.rows || []) as ShiftRow[];

    // attach stable ids
    const withIds: ShiftRowWithId[] = rows.map((r) => ({ ...r, _id: rowId(r) }));

    setSchedule(withIds);
    setShiftSchedule(rows); // global state stays pure (no _id)
    setAnswer("—");
    setPending([]);
    setApprovalStatus("idle");
    setSwapPick(null);

    const t = rows.find((r) => r.team)?.team;
    if (t) setActiveTeam(t);
  }

  async function askShiftQuestion() {
    if (!question.trim()) return;
    if (!schedule.length) return setAnswer("Upload a schedule first.");

    setLoading(true);
    try {
      const pureRows: ShiftRow[] = schedule.map(({ _id, ...rest }) => rest);
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "auto",
          messages: [
            { role: "system", content: "Answer strictly from schedule rows. If unsure, ask 1 short follow-up." },
            { role: "user", content: `Schedule Rows (JSON):\n${JSON.stringify(pureRows, null, 2)}\n\nQuestion:\n${question}` },
          ],
        }),
      });

      const data = await res.json().catch(() => ({}));
      setAnswer(String(data?.text ?? "No answer."));
    } catch (e: any) {
      setAnswer(`Error: ${e?.message || "Failed."}`);
    } finally {
      setLoading(false);
    }
  }

  function beginOrCompleteSwap(clicked: ShiftRowWithId) {
    if (!swapPick) {
      setSwapPick({ rowId: clicked._id, row: clicked });
      return;
    }

    if (swapPick.rowId === clicked._id) {
      setSwapPick(null);
      return;
    }

    // swap by ID in the actual schedule array
    setSchedule((prev) => {
      const copy = [...prev];
      const aIdx = copy.findIndex((x) => x._id === swapPick.rowId);
      const bIdx = copy.findIndex((x) => x._id === clicked._id);
      if (aIdx < 0 || bIdx < 0) return prev;

      const a = copy[aIdx];
      const b = copy[bIdx];
      copy[aIdx] = b;
      copy[bIdx] = a;
      return copy;
    });

    // update shared global state (pure rows, keep same swap by matching content ids)
    const newGlobal: ShiftRow[] = (() => {
      const pure = schedule.map(({ _id, ...rest }) => rest);
      const aIdx = schedule.findIndex((x) => x._id === swapPick.rowId);
      const bIdx = schedule.findIndex((x) => x._id === clicked._id);
      if (aIdx < 0 || bIdx < 0) return pure;
      const copy = [...pure];
      const a = copy[aIdx];
      const b = copy[bIdx];
      copy[aIdx] = b;
      copy[bIdx] = a;
      return copy;
    })();
    setShiftSchedule(newGlobal);

    setPending((p) => [
      ...p,
      {
        id: uid(),
        kind: "swap",
        createdAt: Date.now(),
        note: "User swapped two shifts (pending admin approval).",
        before: swapPick.row,
        after: clicked,
      },
    ]);

    setSwapPick(null);
    setApprovalStatus("idle");
  }

  function onClickShiftForChat(r: ShiftRow) {
    setLinkedShift(r);
    setChatInput((prev) => (prev ? prev : "Quick note about this shift: "));
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text) return;

    const msg: ChatMsg = {
      id: uid(),
      createdAt: Date.now(),
      scope: chatScope,
      team: chatScope === "team" ? activeTeam : undefined,
      toMemberId: chatScope === "dm" ? dmTo : undefined,
      from: "You",
      text,
      linkedShift: linkedShift ?? undefined,
    };

    try {
      const saved = await postChat(msg);
      setChat((prev) => [...prev, saved]);
      setChatInput("");
      setLinkedShift(null);
    } catch {
      setChatInput((prev) => prev || "⚠️ Could not send. Try again.");
    }
  }

  async function submitForApproval() {
    if (!pending.length) return;

    setApprovalStatus("sending");
    try {
      const payload = {
        adminEmail: ADMIN_EMAIL,
        proposedAt: new Date().toISOString(),
        pendingChanges: pending,
        scheduleSnapshot: schedule.map(({ _id, ...rest }) => rest),
      };

      const res = await fetch("/api/schedule-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text().catch(() => "Approval request failed"));
      setApprovalStatus("sent");
      setAnswer(`✅ Submitted for approval to ${ADMIN_EMAIL}. Waiting for admin confirmation.`);
    } catch (e: any) {
      setApprovalStatus("idle");
      setAnswer(`⚠️ Could not email admin. ${e?.message || ""}`.trim());
    }
  }

  function clearPending() {
    setPending([]);
    setApprovalStatus("idle");
  }

  const membersInTeam = useMemo(
    () => members.filter((m) => m.team === activeTeam && m.role !== "Admin"),
    [members, activeTeam]
  );

  return (
    <AppShell>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Form 3 — Shift Report (Phase 2)</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Upload schedule, preview, propose swaps, chat with team, and submit for admin approval.
            </p>
          </div>

          <div className="rounded-2xl bg-black/30 px-3 py-2 text-xs text-zinc-300 shadow-inner">
            <span className="text-zinc-500">Admin:</span>{" "}
            <span className="font-semibold text-sky-300">{ADMIN_EMAIL}</span>
            <span className="mx-2 text-zinc-600">•</span>
            <span className="text-zinc-500">Rows:</span> {summary.total}
            <span className="mx-2 text-zinc-600">•</span>
            <span className="text-zinc-500">Showing:</span> {summary.shown}
            <span className="mx-2 text-zinc-600">•</span>
            <span className="text-red-300">Fatigue:</span> {summary.fatigues}
            <span className="mx-2 text-zinc-600">•</span>
            <span className="text-amber-300">Proposed:</span> {pending.length}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => downloadCSV("updated_shift_schedule.csv", toCSV(schedule.map(({ _id, ...rest }) => rest)))}
            disabled={!schedule.length}
          >
            Download CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submitForApproval}
            disabled={!pending.length || approvalStatus === "sending"}
          >
            {approvalStatus === "sending" ? "Sending…" : "Submit for Approval"}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearPending} disabled={!pending.length}>
            Clear Proposed
          </Button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* LEFT */}
          <div className="space-y-5 lg:col-span-1">
            <div className="rounded-3xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
              <div className="text-xs font-semibold uppercase text-zinc-400">Upload Schedule</div>
              <div className="mt-3">
                <input type="file" accept=".csv,.xlsx" onChange={handleUpload} className="text-sm text-zinc-300" />
              </div>
              {schedule.length > 0 && (
                <div className="mt-3 text-xs text-emerald-400">{schedule.length} rows loaded.</div>
              )}
            </div>

            <div className="rounded-3xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
              <div className="text-xs font-semibold uppercase text-zinc-400">Ask a Shift Question</div>
              <div className="mt-3 space-y-3">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., Am I working tomorrow? What unit am I on Friday?"
                  className="w-full rounded-xl bg-black/30 px-4 py-3 text-sm text-white outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                />
                <Button variant="primary" onClick={askShiftQuestion} disabled={loading}>
                  {loading ? "Thinking..." : "Ask AI"}
                </Button>
              </div>
            </div>

            <div className="rounded-3xl bg-black/30 p-5 shadow-inner">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">AI Answer</div>
              <div className="mt-3 whitespace-pre-wrap text-sm text-zinc-200">{answer}</div>
            </div>
          </div>

          {/* MIDDLE */}
          <div className="space-y-5 lg:col-span-1">
            <div className="rounded-3xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase text-zinc-400">Members</div>
                  <div className="mt-1 text-xs text-zinc-500">Mock roster for hackathon. Profiles later.</div>
                </div>

                <select
                  value={activeTeam}
                  onChange={(e) => {
                    setActiveTeam(e.target.value);
                    setChatScope("team");
                  }}
                  className="h-9 rounded-xl bg-black/30 px-3 text-xs text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                  title="Select team"
                >
                  {teamOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                {membersInTeam.length === 0 ? (
                  <div className="text-sm text-zinc-400">No mock members for this team yet.</div>
                ) : (
                  membersInTeam.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-2xl bg-black/30 px-3 py-2 text-sm text-zinc-200 shadow-inner"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{m.name}</div>
                        <div className="text-xs text-zinc-500">{m.role} • Team {m.team}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setChatScope("dm");
                          setDmTo(m.id);
                        }}
                        title="Message this member"
                      >
                        DM
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 rounded-2xl bg-black/30 p-3 text-xs text-zinc-400 shadow-inner">
                Admin approver: <span className="font-semibold text-sky-300">{ADMIN_EMAIL}</span>
              </div>
            </div>

            <div className="rounded-3xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase text-zinc-400">Team Chat</div>
                  <div className="mt-1 text-xs text-zinc-500">Persistent. Click a shift date to link it.</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setChatScope("team")}
                    className={
                      chatScope === "team"
                        ? "h-9 rounded-xl bg-sky-500/20 px-3 text-xs font-semibold text-sky-200 shadow-[0_0_0_1px_rgba(56,189,248,.35)]"
                        : "h-9 rounded-xl bg-black/30 px-3 text-xs text-zinc-200 shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                    }
                  >
                    Team
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatScope("dm")}
                    className={
                      chatScope === "dm"
                        ? "h-9 rounded-xl bg-sky-500/20 px-3 text-xs font-semibold text-sky-200 shadow-[0_0_0_1px_rgba(56,189,248,.35)]"
                        : "h-9 rounded-xl bg-black/30 px-3 text-xs text-zinc-200 shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                    }
                  >
                    DM
                  </button>
                </div>
              </div>

              {chatScope === "dm" && (
                <div className="mt-3">
                  <select
                    value={dmTo}
                    onChange={(e) => setDmTo(e.target.value)}
                    className="h-9 w-full rounded-xl bg-black/30 px-3 text-xs text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                  >
                    {members.filter((m) => m.role !== "Admin").map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} • {m.team}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-3 max-h-[260px] space-y-2 overflow-auto rounded-2xl bg-black/30 p-3 shadow-inner">
                {chat.length === 0 ? (
                  <div className="text-sm text-zinc-400">No messages yet.</div>
                ) : (
                  chat.map((m) => (
                    <div key={m.id} className="rounded-2xl bg-white/5 px-3 py-2 text-sm text-zinc-200">
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <span>{m.from}</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                      </div>
                      {m.linkedShift?.date && (
                        <div className="mt-1 rounded-xl bg-black/30 px-2 py-1 text-[11px] text-sky-200 shadow-inner">
                          Linked shift: {m.linkedShift.date} {m.linkedShift.start}-{m.linkedShift.end} • {m.linkedShift.unit} •{" "}
                          {m.linkedShift.team}
                        </div>
                      )}
                      <div className="mt-1">{m.text}</div>
                    </div>
                  ))
                )}
              </div>

              {linkedShift?.date && (
                <div className="mt-3 rounded-2xl bg-sky-500/10 px-3 py-2 text-xs text-sky-200 ring-1 ring-sky-400/20">
                  Linking shift:{" "}
                  <span className="font-semibold">
                    {linkedShift.date} {linkedShift.start}-{linkedShift.end} • {linkedShift.unit} • {linkedShift.team}
                  </span>
                  <button className="ml-2 text-zinc-300 underline" onClick={() => setLinkedShift(null)} type="button">
                    clear
                  </button>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Message…"
                  className="h-11 flex-1 rounded-2xl bg-black/30 px-4 text-sm text-zinc-100 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)] placeholder:text-zinc-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendChat();
                  }}
                />
                <Button variant="primary" onClick={sendChat} disabled={!chatInput.trim()}>
                  Send
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="rounded-3xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,.08)] lg:col-span-1">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-zinc-400">Schedule Preview</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Click a row to swap (select one, then another). Click the date text to link into chat.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search (date/unit/team)…"
                  className="h-9 w-[190px] rounded-xl bg-black/30 px-3 text-xs text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)] placeholder:text-zinc-500"
                />

                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="h-9 rounded-xl bg-black/30 px-3 text-xs text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                >
                  <option value="all">All months</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="h-9 rounded-xl bg-black/30 px-3 text-xs text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                >
                  <option value="all">All units</option>
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setNext14((v) => !v)}
                  className={
                    next14
                      ? "h-9 rounded-xl bg-sky-500/20 px-3 text-xs font-semibold text-sky-200 shadow-[0_0_0_1px_rgba(56,189,248,.35)]"
                      : "h-9 rounded-xl bg-black/30 px-3 text-xs text-zinc-200 shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                  }
                >
                  Next 14d
                </button>
              </div>
            </div>

            {swapPick && (
              <div className="mt-3 rounded-2xl bg-sky-500/10 px-3 py-2 text-xs text-sky-200 ring-1 ring-sky-400/20">
                Swap mode: selected{" "}
                <span className="font-semibold">
                  {swapPick.row.date} {swapPick.row.start}-{swapPick.row.end} • {swapPick.row.unit} •{" "}
                  {swapPick.row.team}
                </span>
                . Click another shift to swap (or click the same again to cancel).
              </div>
            )}

            <div className="mt-4 overflow-hidden rounded-2xl bg-black/30 shadow-inner">
              <div className="grid grid-cols-[180px_90px_90px_1fr_1fr] gap-2 border-b border-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <div>Date</div>
                <div>Start</div>
                <div>End</div>
                <div>Unit</div>
                <div>Team</div>
              </div>

              <div className="max-h-[520px] overflow-auto">
                  {filtered.length === 0 ? (
                  <div className="px-3 py-6 text-sm text-zinc-400">No rows match your filters.</div>
                ) : (
                  filtered.map((r, idx) => {
                    const isToday = r.date === tISO;
                    const soon = inNextDays(r.date || "", 14);

                    const rest = fatigueById.get(r._id);
                    const fatigued = rest != null && rest < 10;

                    const picked = swapPick?.rowId === r._id;

                    return (
                      <div
                        key={r._id}
                        onClick={() => beginOrCompleteSwap(r)}
                        role="button"
                        tabIndex={0}
                        className={
                          "cursor-pointer w-full text-left grid grid-cols-[180px_90px_90px_1fr_1fr] gap-2 px-3 py-2 text-sm text-zinc-200 transition " +
                          (picked
                            ? "bg-sky-500/10 ring-1 ring-sky-400/25"
                            : isToday
                            ? "bg-emerald-400/10"
                            : idx % 2 === 0
                            ? "bg-white/[0.02]"
                            : "bg-transparent") +
                          " hover:bg-white/[0.03]"
                        }
                        title="Click to select for swap"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="whitespace-nowrap underline decoration-white/10 hover:decoration-white/30 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation(); // prevents swap click
                              onClickShiftForChat({
                                date: r.date,
                                start: r.start,
                                end: r.end,
                                unit: r.unit,
                                team: r.team,
                              });
                            }}
                            title="Link this shift to chat"
                          >
                            {fmtDayLabel(r.date || "")}
                          </span>

                          {isToday && (
                            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                              TODAY
                            </span>
                          )}
                          {!isToday && soon && (
                            <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                              UPCOMING
                            </span>
                          )}
                          {fatigued && (
                            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-200">
                              REST {rest?.toFixed(1)}h
                            </span>
                          )}
                        </div>

                        <div>{r.start || "—"}</div>
                        <div>{r.end || "—"}</div>
                        <div className="text-zinc-300">{r.unit || "—"}</div>
                        <div className="text-zinc-400">{r.team || "—"}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-4 text-xs text-zinc-500">
              Proposed swaps are not official until admin approval is emailed to{" "}
              <span className="text-sky-300 font-semibold">{ADMIN_EMAIL}</span>.
            </div>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
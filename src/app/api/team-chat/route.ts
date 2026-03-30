/* ===========================
FILE: /app/api/team-chat/route.ts

V2: Coordination Thread
- multi-channel ready
- project-aware
- upload-aware
- persistent JSON store for hackathon demo
=========================== */

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

type LinkedContext = {
  projectId?: string | number;
  projectName?: string;
  uploadId?: string;
  uploadName?: string;
  detectedType?: string;
};

type ChatMsg = {
  id: string;
  createdAt: number;

  scope: "team" | "dm" | "review_thread";

  team?: string;
  toMemberId?: string;

  from: string;
  text: string;

  sourceChannel?: "web" | "email" | "sms" | "upload";

  linkedContext?: LinkedContext;
  linkedShift?: {
    date?: string;
    start?: string;
    end?: string;
    unit?: string;
    team?: string;
  };
};

type Store = {
  version: number;
  messages: ChatMsg[];
};

const STORE_PATH = path.join(process.cwd(), "data/team_chat.json");

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw || "{}");
    return {
      version: Number(parsed?.version ?? 1),
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
    };
  } catch {
    return { version: 2, messages: [] };
  }
}

async function writeStore(store: Store) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function clampMessages(msgs: ChatMsg[], max = 3000) {
  if (msgs.length <= max) return msgs;
  return msgs.slice(msgs.length - max);
}

function buildThreadSummary(messages: ChatMsg[]) {
  const count = messages.length;

  const channels = Array.from(
    new Set(messages.map((m) => m.sourceChannel).filter(Boolean))
  );

  const linkedProject = messages.find((m) => m.linkedContext?.projectName)?.linkedContext;

  const linkedUpload = messages.find((m) => m.linkedContext?.uploadName)?.linkedContext;

  return {
    count,
    channels,
    linkedProject: linkedProject
      ? {
          projectId: linkedProject.projectId,
          projectName: linkedProject.projectName,
        }
      : null,
    linkedUpload: linkedUpload
      ? {
          uploadId: linkedUpload.uploadId,
          uploadName: linkedUpload.uploadName,
          detectedType: linkedUpload.detectedType,
        }
      : null,
  };
}

// GET examples:
// /api/team-chat?scope=team&team=Safety%20Review
// /api/team-chat?scope=review_thread&projectId=12345
// /api/team-chat?scope=review_thread&projectId=12345&uploadId=u_abc
export async function GET(req: Request) {
  const url = new URL(req.url);

  const scope = (url.searchParams.get("scope") || "team") as
    | "team"
    | "dm"
    | "review_thread";

  const team = url.searchParams.get("team") || "";
  const toMemberId = url.searchParams.get("toMemberId") || "";
  const projectId = url.searchParams.get("projectId") || "";
  const uploadId = url.searchParams.get("uploadId") || "";

  const store = await readStore();
  let messages = store.messages;

  if (scope === "team") {
    messages = messages.filter((m) => m.scope === "team" && (m.team || "") === team);
  }

  if (scope === "dm") {
    messages = messages.filter(
      (m) => m.scope === "dm" && (m.toMemberId || "") === toMemberId
    );
  }

  if (scope === "review_thread") {
    messages = messages.filter((m) => {
      const msgProjectId = String(m.linkedContext?.projectId || "");
      const msgUploadId = String(m.linkedContext?.uploadId || "");

      const projectMatch = projectId ? msgProjectId === projectId : true;
      const uploadMatch = uploadId ? msgUploadId === uploadId : true;

      return projectMatch && uploadMatch;
    });
  }

  messages.sort((a, b) => a.createdAt - b.createdAt);

  return NextResponse.json({
    ok: true,
    summary: buildThreadSummary(messages),
    messages,
  });
}

// POST body supports thread messages linked to project/upload context
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<ChatMsg> | null;

  if (!body?.text || !body?.from) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  const scope =
    body.scope === "dm"
      ? "dm"
      : body.scope === "review_thread"
      ? "review_thread"
      : "team";

  const msg: ChatMsg = {
    id: String(body.id || crypto.randomUUID()),
    createdAt: Number(body.createdAt || Date.now()),
    scope,

    team: scope === "team" ? String(body.team || "") : undefined,
    toMemberId: scope === "dm" ? String(body.toMemberId || "") : undefined,

    from: String(body.from),
    text: String(body.text).slice(0, 3000),

    sourceChannel:
      body.sourceChannel === "email" ||
      body.sourceChannel === "sms" ||
      body.sourceChannel === "upload"
        ? body.sourceChannel
        : "web",

    linkedContext: body.linkedContext
      ? {
          projectId: body.linkedContext.projectId,
          projectName: body.linkedContext.projectName,
          uploadId: body.linkedContext.uploadId,
          uploadName: body.linkedContext.uploadName,
          detectedType: body.linkedContext.detectedType,
        }
      : undefined,

    linkedShift: body.linkedShift,
  };

  if (msg.scope === "team" && !msg.team) {
    return NextResponse.json(
      { ok: false, error: "Team required for team scope" },
      { status: 400 }
    );
  }

  if (msg.scope === "dm" && !msg.toMemberId) {
    return NextResponse.json(
      { ok: false, error: "toMemberId required for dm scope" },
      { status: 400 }
    );
  }

  const store = await readStore();
  store.messages = clampMessages([...store.messages, msg], 3000);
  await writeStore(store);

  return NextResponse.json({
    ok: true,
    message: msg,
    summary: buildThreadSummary(store.messages),
  });
}

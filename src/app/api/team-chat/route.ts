/* ===========================
FILE: /app/api/team-chat/route.ts
Persistent chat via JSON file (hackathon-safe)
=========================== */

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

type ShiftRow = {
  date?: string;
  start?: string;
  end?: string;
  unit?: string;
  team?: string;
};

type ChatMsg = {
  id: string;
  createdAt: number;
  scope: "team" | "dm";
  team?: string;
  toMemberId?: string;
  from: string;
  text: string;
  linkedShift?: ShiftRow;
};

type Store = {
  version: number;
  messages: ChatMsg[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "team_chat.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: Store = { version: 1, messages: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
  }
}

async function readStore(): Promise<Store> {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  const parsed = JSON.parse(raw || "{}");
  return {
    version: Number(parsed?.version ?? 1),
    messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
  };
}

async function writeStore(store: Store) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function clampMessages(msgs: ChatMsg[], max = 2000) {
  if (msgs.length <= max) return msgs;
  return msgs.slice(msgs.length - max);
}

// GET /api/team-chat?scope=team&team=Bravo
// GET /api/team-chat?scope=dm&toMemberId=m1
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") || "team") as "team" | "dm";
  const team = url.searchParams.get("team") || "";
  const toMemberId = url.searchParams.get("toMemberId") || "";

  const store = await readStore();
  let messages = store.messages;

  if (scope === "team") {
    messages = messages.filter((m) => m.scope === "team" && (m.team || "") === team);
  } else {
    messages = messages.filter((m) => m.scope === "dm" && (m.toMemberId || "") === toMemberId);
  }

  // return newest last (already append order), but just in case:
  messages.sort((a, b) => a.createdAt - b.createdAt);

  return NextResponse.json({ ok: true, messages });
}

// POST body: ChatMsg (without server trusting client time/id is okay for hackathon)
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<ChatMsg> | null;
  if (!body?.text || !body?.from || !body?.scope) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  // Basic validation
  const msg: ChatMsg = {
    id: String(body.id || crypto.randomUUID()),
    createdAt: Number(body.createdAt || Date.now()),
    scope: body.scope === "dm" ? "dm" : "team",
    team: body.scope === "team" ? String(body.team || "") : undefined,
    toMemberId: body.scope === "dm" ? String(body.toMemberId || "") : undefined,
    from: String(body.from),
    text: String(body.text).slice(0, 2000),
    linkedShift: body.linkedShift ? (body.linkedShift as ShiftRow) : undefined,
  };

  if (msg.scope === "team" && !msg.team) {
    return NextResponse.json({ ok: false, error: "Team required for team scope" }, { status: 400 });
  }
  if (msg.scope === "dm" && !msg.toMemberId) {
    return NextResponse.json({ ok: false, error: "toMemberId required for dm scope" }, { status: 400 });
  }

  const store = await readStore();
  store.messages = clampMessages([...store.messages, msg], 2000);
  await writeStore(store);

  return NextResponse.json({ ok: true, message: msg });
}
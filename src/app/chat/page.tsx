/*
===========================
FILE: /src/app/chat/page.tsx
===========================
*/

import { AppShell } from "@/src/app/components/shell/AppShell";
import { ChatPanel } from "@/src/app/components/chat/ChatPanel";
import { FormPreviewPanel } from "@/src/app/forms/FormPreviewPanel";

export default function ChatPage() {
  return (
    <AppShell>
      <div className="mb-4 flex flex-col gap-2">
        <div className="text-sm text-[#a9b4bc]">Aviation intelligence workspace</div>
        <h1 className="text-2xl font-semibold text-[#eef2f4]">Intelligence Analyst</h1>
        <p className="max-w-3xl text-sm text-[#c9d1d6]">
          Review aircraft, airports, operators, movement signals, and source-backed context
          in one workspace. Use voice or chat to investigate patterns, validate signals, and
          prepare opportunity-focused follow-up.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChatPanel />
        <FormPreviewPanel />
      </div>
    </AppShell>
  );
}
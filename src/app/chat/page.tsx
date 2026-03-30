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
      <div className="grid gap-4 lg:grid-cols-2">
        <ChatPanel />
        <FormPreviewPanel />
      </div>
    </AppShell>
  );
}
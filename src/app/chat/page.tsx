
/*
===========================
FILE: /app/chat/page.tsx
Chat shell (mock)
===========================
*/

import { AppShell } from "@/src/app/components/shell/AppShell";
import { ChatPanel } from "@/src/app/components/chat/ChatPanel";
import { FormPreviewPanel } from "@/src/app/forms/FormPreviewPanel";
import { AppStateProvider } from "@/src/app/components/state/AppState";

export default function ChatPage() {
  return (
    <AppShell>
      <AppStateProvider>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChatPanel />
          <FormPreviewPanel />
        </div>
      </AppStateProvider>
    </AppShell>
  );
}
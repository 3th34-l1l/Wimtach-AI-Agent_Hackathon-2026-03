"use client";

/*
===========================
FILE: /components/forms/FormPreviewPanel.tsx
===========================
*/

import { Card } from "@/src/app/components/ui/Card";
import { useAppState } from "@/src/app/components/state/AppState";

export function FormPreviewPanel() {
  const { selectedForm, weatherSummary, narrative } = useAppState();

  return (
    <Card className="h-[70dvh]">
      <div>
        <div className="text-sm font-medium">Form Preview</div>
        <div className="text-xs text-zinc-400">Will sync live with chat in Phase 2</div>
      </div>

      <div className="mt-4 h-[calc(70dvh-80px)] overflow-auto rounded-2xl bg-black/30 p-4 text-sm text-zinc-300 shadow-inner">
        <div className="text-xs uppercase tracking-wide text-zinc-500">Selected</div>
        <div className="mt-1 text-zinc-200">{selectedForm || "—"}</div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Preview k="Weather" v={weatherSummary || "—"} />
          <Preview k="Narrative" v={narrative || "—"} />
        </div>
      </div>
    </Card>
  );
}

function Preview({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</div>
      <div className="mt-1 font-medium text-zinc-200 break-words">{v}</div>
    </div>
  );
}
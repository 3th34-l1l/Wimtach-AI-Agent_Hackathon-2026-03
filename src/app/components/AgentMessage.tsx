"use client";

import * as React from "react";

export function AgentMessage({
  text,
  meta,
}: {
  text: string;
  meta?: string;
}) {
  return (
    <div className="max-w-[85%] space-y-1">
      <div className="rounded-2xl bg-white/5 px-3 py-2 text-sm text-zinc-200">
        {text}
      </div>
      {meta ? (
        <div className="pl-1 text-[10px] text-zinc-500">{meta}</div>
      ) : null}
    </div>
  );
}
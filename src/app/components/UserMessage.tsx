"use client";

import * as React from "react";

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[85%] rounded-2xl bg-gradient-to-br from-sky-500/40 to-indigo-500/30 px-3 py-2 text-sm text-white">
      {text}
    </div>
  );
}
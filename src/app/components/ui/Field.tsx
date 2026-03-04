"use client";

import React, { useEffect, useRef } from "react";
import { useAppState } from "@/src/app/components/state/AppState";

export function Field({
  id,
  label,
  placeholder,
  textarea,
  className,
  value,
  onChange,
}: {
  id: string; // ✅ required so AI can target fields
  label: string;
  placeholder?: string;
  textarea?: boolean;
  className?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const { focusField } = useAppState();
  const isFocused = focusField && focusField === id;

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // ✅ when focusField changes to this id, scroll it into view
  useEffect(() => {
    if (!isFocused) return;
    const el = inputRef.current;
    if (!el) return;

    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // optional: put cursor there (demo feels magic)
      el.focus();
    } catch {}
  }, [isFocused]);

  const base =
    "shadow-[0_0_0_1px_rgba(255,255,255,.08)] outline-none focus:shadow-[0_0_0_1px_rgba(56,189,248,.35)]";

  // ✅ the glow highlight
  const highlight = isFocused
    ? " ring-2 ring-sky-400/60 shadow-[0_0_0_1px_rgba(56,189,248,.35),0_0_24px_rgba(56,189,248,.18)]"
    : "";

  const extra = className ? ` ${className}` : "";

  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </div>

      {textarea ? (
        <textarea
          ref={inputRef as any}
          id={id}
          name={id}
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          className={
            "min-h-[110px] w-full resize-none rounded-2xl bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 " +
            base +
            highlight +
            extra
          }
        />
      ) : (
        <input
          ref={inputRef as any}
          id={id}
          name={id}
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          className={
            "h-11 w-full rounded-2xl bg-white/5 px-4 text-sm text-zinc-100 placeholder:text-zinc-500 " +
            base +
            highlight +
            extra
          }
        />
      )}
    </label>
  );
}
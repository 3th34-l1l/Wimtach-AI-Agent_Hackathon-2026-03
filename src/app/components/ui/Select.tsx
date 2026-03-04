"use client";

import React, { useEffect, useRef } from "react";
import { useAppState } from "@/src/app/components/state/AppState";

export function Select({
  id,
  label,
  placeholder,
  options,
  className,
  value,
  onChange,
}: {
  id: string; // ✅ required
  label: string;
  placeholder?: string;
  options: string[];
  className?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const { focusField } = useAppState();
  const isFocused = focusField && focusField === id;

  const selectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (!isFocused) return;
    const el = selectRef.current;
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    } catch {}
  }, [isFocused]);

  const base =
    "h-11 w-full rounded-2xl bg-white/5 px-3 text-sm text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,.08)] outline-none focus:shadow-[0_0_0_1px_rgba(56,189,248,.35)]";

  const highlight = isFocused
    ? " ring-2 ring-sky-400/60 shadow-[0_0_0_1px_rgba(56,189,248,.35),0_0_24px_rgba(56,189,248,.18)]"
    : "";

  const extra = className ? ` ${className}` : "";

  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </div>

      <select
        ref={selectRef}
        id={id}
        name={id}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className={base + highlight + extra}
      >
        <option value="">{placeholder ?? "Select"}</option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-zinc-950">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
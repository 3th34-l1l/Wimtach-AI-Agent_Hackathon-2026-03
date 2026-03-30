"use client";

import React, { useEffect, useRef } from "react";
import { useAppState } from "@/src/app/components/state/AppState";

type SelectProps = {
  id: string;
  label: string;
  placeholder?: string;
  options: string[];
  className?: string;
  value?: string;
  onChange?: (v: string) => void;
};

export function Select({
  id,
  label,
  placeholder,
  options,
  className,
  value,
  onChange,
}: SelectProps) {
  const { focusField } = useAppState();
  const isFocused = !!focusField && focusField === id;

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
    "h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#eef2f4] " +
    "outline-none transition-all duration-200 appearance-none " +
    "shadow-[0_0_0_1px_rgba(255,255,255,.03)] " +
    "focus:border-amber-400/30 focus:bg-white/[0.05] " +
    "focus:shadow-[0_0_0_1px_rgba(214,168,79,.22),0_10px_30px_rgba(0,0,0,.20)]";

  const highlight = isFocused
    ? " ring-2 ring-amber-400/45 border-amber-300/30 shadow-[0_0_0_1px_rgba(214,168,79,.24),0_0_24px_rgba(214,168,79,.10)]"
    : "";

  const extra = className ? ` ${className}` : "";

  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a9b4bc]">
        {label}
      </div>

      <div className="relative">
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
            <option key={o} value={o} className="bg-[#151b20] text-[#eef2f4]">
              {o}
            </option>
          ))}
        </select>

        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#a9b4bc]">
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </label>
  );
}
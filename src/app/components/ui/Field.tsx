"use client";

import React, { useEffect, useRef } from "react";
import { useAppState } from "@/src/app/components/state/AppState";

type FieldProps = {
  id: string;
  label: string;
  placeholder?: string;
  textarea?: boolean;
  className?: string;
  value?: string;
  onChange?: (v: string) => void;
};

export function Field({
  id,
  label,
  placeholder,
  textarea,
  className,
  value,
  onChange,
}: FieldProps) {
  const { focusField } = useAppState();
  const isFocused = !!focusField && focusField === id;

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isFocused) return;
    const el = inputRef.current;
    if (!el) return;

    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    } catch {}
  }, [isFocused]);

  const base =
    "w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] text-sm text-[#eef2f4] " +
    "placeholder:text-[#7f8b94] outline-none transition-all duration-200 " +
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

      {textarea ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          id={id}
          name={id}
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          className={
            "min-h-[110px] resize-none px-4 py-3 leading-6 " +
            base +
            highlight +
            extra
          }
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          id={id}
          name={id}
          type="text"
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          className={
            "h-11 px-4 " +
            base +
            highlight +
            extra
          }
        />
      )}
    </label>
  );
}
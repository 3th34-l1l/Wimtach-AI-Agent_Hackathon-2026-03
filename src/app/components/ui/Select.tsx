/*
===========================
FILE: /components/ui/Select.tsx
===========================
*/

export function Select({
  label,
  placeholder,
  options,
  className,
}: {
  label: string;
  placeholder?: string;
  options: string[];
  className?: string; // ✅ added
}) {
  const base =
    "h-11 w-full rounded-2xl bg-white/5 px-3 text-sm text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,.08)] outline-none focus:shadow-[0_0_0_1px_rgba(56,189,248,.35)]";

  const extra = className ? ` ${className}` : "";

  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </div>

      <select className={base + extra}>
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
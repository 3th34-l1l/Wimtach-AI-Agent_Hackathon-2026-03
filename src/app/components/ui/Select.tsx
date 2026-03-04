
/*
===========================
FILE: /components/ui/Select.tsx
===========================
*/

export function Select({
  label,
  placeholder,
  options,
}: {
  label: string;
  placeholder?: string;
  options: string[];
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
      <select className="h-11 w-full rounded-2xl bg-white/5 px-3 text-sm text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,.08)] outline-none focus:shadow-[0_0_0_1px_rgba(56,189,248,.35)]">
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

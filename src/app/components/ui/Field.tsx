
/*
===========================
FILE: /components/ui/Field.tsx
===========================
*/

export function Field({
  label,
  placeholder,
  textarea,
}: {
  label: string;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
      {textarea ? (
        <textarea
          placeholder={placeholder}
          className="min-h-[110px] w-full resize-none rounded-2xl bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-[0_0_0_1px_rgba(255,255,255,.08)] outline-none focus:shadow-[0_0_0_1px_rgba(56,189,248,.35)]"
        />
      ) : (
        <input
          placeholder={placeholder}
          className="h-11 w-full rounded-2xl bg-white/5 px-4 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-[0_0_0_1px_rgba(255,255,255,.08)] outline-none focus:shadow-[0_0_0_1px_rgba(56,189,248,.35)]"
        />
      )}
    </label>
  );
}


/*
===========================
FILE: /components/ui/Button.tsx
===========================
*/

import clsx from "clsx";

type Variant = "primary" | "ghost";

export function Button({
  variant = "ghost",
  size = "md",
  className,
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
}) {
  return (
    <button
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center rounded-2xl font-medium transition focus:outline-none",
        size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-4 text-sm",
        variant === "primary"
          ? "bg-gradient-to-br from-sky-500/80 to-indigo-500/70 text-white shadow-[0_0_0_1px_rgba(255,255,255,.12)] hover:from-sky-500 hover:to-indigo-500"
          : "bg-white/5 text-zinc-200 shadow-[0_0_0_1px_rgba(255,255,255,.10)] hover:bg-white/7",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

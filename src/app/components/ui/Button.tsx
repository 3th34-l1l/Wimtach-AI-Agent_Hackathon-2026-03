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
        "inline-flex items-center justify-center rounded-2xl font-medium transition-all duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-amber-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1418]",
        size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-4 text-sm",
        variant === "primary"
          ? [
              "text-[#fffdf8]",
              "bg-gradient-to-br from-[#c7953d] via-[#d6a84f] to-[#b98433]",
              "shadow-[0_0_0_1px_rgba(255,255,255,.10),0_10px_30px_rgba(0,0,0,.22)]",
              "hover:from-[#d2a24b] hover:via-[#e0b45d] hover:to-[#c08c3a]",
              "active:scale-[0.99]",
            ]
          : [
              "bg-white/[0.04] text-[#d7dee3]",
              "border border-white/[0.08]",
              "shadow-[0_0_0_1px_rgba(255,255,255,.03)]",
              "hover:bg-white/[0.07] hover:text-[#eef2f4]",
              "active:scale-[0.99]",
            ],
        disabled && "cursor-not-allowed opacity-50 hover:scale-100",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
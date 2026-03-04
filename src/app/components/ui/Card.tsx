
/*
===========================
FILE: /components/ui/Card.tsx
===========================
*/

import clsx from "clsx";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "rounded-3xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,.08)]",
        className
      )}
    >
      {children}
    </div>
  );
}

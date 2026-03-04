"use client";

import * as React from "react";
import { Button } from "@/src/app/components/ui/Button";
import { Card } from "@/src/app/components/ui/Card";

export function ConfirmationModal({
  open,
  title = "Confirm",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onMouseDown={(e) => {
        // click outside closes
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <Card className="w-full max-w-md">
        <div className="space-y-2">
          <div className="text-base font-semibold">{title}</div>
          {description ? (
            <div className="text-sm text-zinc-400">{description}</div>
          ) : null}
        </div>

        {children ? <div className="mt-4">{children}</div> : null}

        <div className="mt-5 flex justify-end gap-2">
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel}>
                {cancelLabel}
            </Button>

            <Button variant="ghost" onClick={onConfirm}>
                {confirmLabel}
            </Button>
            </div>
        </div>
      </Card>
    </div>
  );
}
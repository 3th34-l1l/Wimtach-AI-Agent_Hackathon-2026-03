"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/src/app/components/shell/Sidebar";
import { TopNav } from "@/src/app/components/shell/TopNav";
import { VoiceMount } from "../voice/VoiceMount";
import { useAppState } from "@/src/app/components/state/AppState";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dispatchAction } = useAppState();

  useEffect(() => {
    dispatchAction({ type: "SET_ACTIVE_PAGE", page: pathname || "/chat" });
  }, [pathname, dispatchAction]);

  return (
    <div className="min-h-dvh">
      <div className="mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-[260px_1fr]">
        <Sidebar />
        <div className="min-h-dvh">
          <TopNav />
          <main className="px-4 pb-10 pt-4 md:px-6">{children}</main>

          {/* keep it mounted across all pages */}
          <VoiceMount />
        </div>
      </div>
    </div>
  );
}
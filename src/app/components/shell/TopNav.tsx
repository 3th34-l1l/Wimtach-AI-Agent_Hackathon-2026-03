
/*
===========================
FILE: /components/shell/TopNav.tsx
===========================
*/

import Link from "next/link";
import { Globe, Mic } from "lucide-react";
import { Button } from "@/src/app/components/ui/Button";

export function TopNav() {
  return (
    <div className="sticky top-0 z-20 border-b border-white/5 bg-black/30 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 lg:hidden">
          <Link href="/" className="text-sm font-semibold">EffectiveAI</Link>
          <span className="text-xs text-zinc-500">Prototype</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" title="Language">
            <Globe className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">EN</span>
          </Button>
          <Button variant="primary" size="sm" title="Voice">
            <Mic className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Voice</span>
          </Button>
          <div className="h-9 w-9 rounded-full bg-white/10" title="Profile" />
        </div>
      </div>
    </div>
  );
}

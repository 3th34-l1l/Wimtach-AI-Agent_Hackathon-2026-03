import Link from "next/link";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Button } from "@/src/app/components/ui/Button";

export default function FormsIndexPage() {
  return (
    <AppShell>
      <Card>
        <h1 className="text-xl font-semibold">Forms</h1>
        <p className="mt-1 text-sm text-zinc-400">Choose a form to complete.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/forms/occurrence"><Button className="w-full">Occurrence Report</Button></Link>
          <Link href="/forms/teddy-bear"><Button className="w-full">Teddy Bear Tracking</Button></Link>
          <Link href="/forms/shift"><Button className="w-full">Shift Report</Button></Link>
          <Link href="/forms/status"><Button className="w-full">Paramedic Status Checklist</Button></Link>
        </div>
      </Card>
    </AppShell>
  );
}
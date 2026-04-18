import Link from "next/link";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Button } from "@/src/app/components/ui/Button";

type FormLink = {
  href: string;
  label: string;
  description: string;
};

const primaryWorkspaces: FormLink[] = [
  {
    href: "/forms/corsia-intelligence",
    label: "CORSIA Intelligence",
    description: "Operator ranking, compliance signals, weighted lead review, and pre-contact intelligence.",
  },
  {
    href: "/forms/operators",
    label: "Operators Workspace",
    description: "Single-operator deep workspace for contacts, notes, inference, and outreach drafting.",
  },
];

const standardForms: FormLink[] = [
  {
    href: "/forms/occurrence",
    label: "Occurrence Report",
    description: "Log and review operational incidents and occurrence details.",
  },
  {
    href: "/forms/teddy-bear",
    label: "Teddy Bear Tracking",
    description: "Track teddy bear program usage and related entries.",
  },
  {
    href: "/forms/shift",
    label: "Shift Report",
    description: "Complete and review shift reporting details.",
  },
  {
    href: "/forms/status",
    label: "Paramedic Status Checklist",
    description: "Run through current status and readiness checks.",
  },
  {
    href: "/forms/decision-queue",
    label: "Decision Queue",
    description: "Review and prioritize business and operational decisions.",
  },
  {
    href: "/forms/opportunity-pipeline",
    label: "Opportunity Pipeline",
    description: "Track opportunities, status, and movement through the pipeline.",
  },
  {
    href: "/forms/rewards-hub",
    label: "Rewards Hub",
    description: "View reward-related workflows and retention levers.",
  },
  {
    href: "/forms/charter-referral-network",
    label: "Referral Network",
    description: "Manage referral and charter partner workflow.",
  },
  {
    href: "/forms/intelmap",
    label: "Intel Map",
    description: "Live airport and aircraft intelligence map workspace.",
  },
];

function LinkCard({ href, label, description }: FormLink) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-white">{label}</div>
          <div className="mt-2 text-sm text-zinc-400">{description}</div>
        </div>

        <Button className="w-full">{label}</Button>
      </div>
    </Link>
  );
}

export default function FormsIndexPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <Card>
          <h1 className="text-xl font-semibold">Forms & Workspaces</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Launch a workflow, intelligence page, or operator workspace.
          </p>
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Primary Intelligence Workspaces</h2>
            <p className="mt-1 text-sm text-zinc-400">
              These are the new business-critical pages for operator intelligence and outreach prep.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {primaryWorkspaces.map((item) => (
              <LinkCard key={item.href} {...item} />
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Other Forms & Tools</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Existing forms and internal workflow pages.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {standardForms.map((item) => (
              <LinkCard key={item.href} {...item} />
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
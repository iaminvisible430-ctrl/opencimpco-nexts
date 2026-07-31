import { Brain, Check, FileCode2, Globe, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import type { AgentStep } from "@/lib/agent-steps";
import { cn } from "@/lib/utils";

const ICONS = {
  plan: Brain,
  search: Globe,
  file: FileCode2,
  selftest: ShieldCheck,
  verify: Sparkles,
} as const;

export function AgentActivity({ steps }: { steps: AgentStep[] }) {
  if (!steps.length) return null;
  return (
    <div className="rounded-xl border border-border bg-[oklch(1_0_0_/_0.03)] p-1.5">
      <ul className="space-y-0.5">
        {steps.map((s) => {
          const Icon = ICONS[s.kind];
          const active = s.state === "active";
          return (
            <li
              key={s.id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px]",
                active && "bg-[oklch(1_0_0_/_0.04)]",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-md",
                  active
                    ? "bg-[oklch(0.8_0.12_190_/_0.16)] text-[color:var(--signal)]"
                    : "bg-[oklch(1_0_0_/_0.06)] text-muted-foreground",
                )}
              >
                {active ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-medium",
                  active ? "shimmer-text" : "text-muted-foreground",
                )}
              >
                {s.label}
                {s.detail ? <span className="opacity-70"> · {s.detail}</span> : null}
              </span>
              {!active && <Check className="h-3.5 w-3.5 shrink-0 text-[color:var(--success)]" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Skeleton shown between "send" and the first streamed token. */
export function AgentBooting() {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-[oklch(1_0_0_/_0.03)] p-3">
      <div className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[color:var(--signal)]" />
        <span className="shimmer-text text-[12.5px] font-semibold">Reading your project…</span>
      </div>
      <div className="space-y-1.5">
        <div className="shimmer-bar h-2.5 w-4/5 rounded-full" />
        <div className="shimmer-bar h-2.5 w-3/5 rounded-full" />
        <div className="shimmer-bar h-2.5 w-2/3 rounded-full" />
      </div>
    </div>
  );
}

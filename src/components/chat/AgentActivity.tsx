import {
  AlertTriangle,
  BookOpen,
  Brain,
  Check,
  FileCode2,
  FilePlus2,
  Globe,
  Loader2,
  PlayCircle,
  Scissors,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";
import type { AgentStep, StepKind } from "@/lib/agent-steps";
import { cn } from "@/lib/utils";

const ICONS: Record<StepKind, typeof Brain> = {
  plan: Brain,
  search: Globe,
  read: BookOpen,
  file: FileCode2,
  write: FilePlus2,
  edit: Scissors,
  rm: Trash2,
  check: ShieldCheck,
  selftest: ShieldCheck,
  verify: Sparkles,
  resume: PlayCircle,
  fallback: Shuffle,
  tool: Terminal,
};




export function AgentActivity({ steps }: { steps: AgentStep[] }) {
  if (!steps.length) return null;
  return (
    <div className="rounded-xl border border-border bg-[oklch(1_0_0_/_0.03)] p-1.5">
      <ul className="space-y-0.5">
        {steps.map((s) => {
          const Icon = ICONS[s.kind];
          const active = s.state === "active";
          const failed = s.state === "error";
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
                    : failed
                      ? "bg-[oklch(0.7_0.19_25_/_0.16)] text-[color:var(--destructive)]"
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
                  active ? "shimmer-text" : failed ? "text-[color:var(--destructive)]" : "text-muted-foreground",
                )}
              >
                {s.label}
                {s.detail ? <span className="opacity-70"> · {s.detail}</span> : null}
              </span>
              {failed ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[color:var(--destructive)]" />
              ) : (
                !active && <Check className="h-3.5 w-3.5 shrink-0 text-[color:var(--success)]" />
              )}
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

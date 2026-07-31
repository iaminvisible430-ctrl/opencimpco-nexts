import { Brain, Check, Eye, Search, Sparkles, X, Zap } from "lucide-react";
import { CODEX_MODELS, MODEL_GROUPS, type CodexModelId } from "@/lib/models";
import { useEffect, useMemo, useState } from "react";

export function ModelSheet({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: CodexModelId;
  onChange: (id: CodexModelId) => void;
}) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = CODEX_MODELS.filter(
      (m) =>
        !needle ||
        m.name.toLowerCase().includes(needle) ||
        m.tagline.toLowerCase().includes(needle) ||
        m.tags.some((t) => t.toLowerCase().includes(needle)),
    );
    return MODEL_GROUPS.map((g) => ({ group: g, items: match.filter((m) => m.group === g) })).filter(
      (g) => g.items.length,
    );
  }, [q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-card shadow-2xl sm:max-h-[80dvh] sm:rounded-3xl"
      >
        <div className="shrink-0 px-4 pt-3 sm:px-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-black sm:text-2xl">Choose a model</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Every model thinks, reads attachments and follows the same design playbook.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="tap tap-press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[oklch(1_0_0_/_0.06)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[oklch(1_0_0_/_0.05)] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search models…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
          {groups.map(({ group, items }) => (
            <div key={group} className="mb-5 last:mb-0">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {group}
              </div>
              <div className="space-y-2.5">
                {items.map((m) => {
                  const active = m.id === value;
                  const Icon = m.speed === "fast" ? Zap : m.speed === "deep" ? Sparkles : Brain;
                  return (
                    <button
                      key={m.id}
                      onClick={() => onChange(m.id)}
                      className={`panel flex w-full items-start gap-3 p-3.5 text-left transition ${
                        active ? "border-primary/60 bg-[oklch(0.76_0.16_62_/_0.12)]" : ""
                      }`}
                    >
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-[oklch(1_0_0_/_0.06)] text-foreground"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <div className="text-[15px] font-bold leading-tight">{m.name}</div>
                          {m.thinking && (
                            <span className="pill bg-[oklch(0.76_0.16_62_/_0.2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--ember)]">
                              Thinking
                            </span>
                          )}
                          <span className="pill flex items-center gap-1 bg-[oklch(1_0_0_/_0.06)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            <Eye className="h-3 w-3" />
                            {m.vision ? "Vision" : "OCR"}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                          {m.tagline}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.tags.map((t) => (
                            <span
                              key={t}
                              className="pill bg-[oklch(1_0_0_/_0.04)] px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 text-[11px] font-semibold text-muted-foreground">
                          {m.cost} credits / message · {m.providerKey}
                        </div>
                      </div>
                      {active && <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!groups.length && (
            <div className="py-10 text-center text-sm text-muted-foreground">No models match “{q}”.</div>
          )}
        </div>
      </div>
    </div>
  );
}

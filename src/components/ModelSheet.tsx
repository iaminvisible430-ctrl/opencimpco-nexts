import { Check, Sparkles, Zap, Brain } from "lucide-react";
import { CODEX_MODELS, type CodexModelId } from "@/lib/models";
import { useEffect } from "react";

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-t-3xl bg-card p-5 pb-8 shadow-2xl"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        <h2 className="text-2xl font-black">Choose a model</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deep models think longer and reason better.
        </p>
        <div className="mt-5 space-y-3">
          {CODEX_MODELS.map((m) => {
            const active = m.id === value;
            const Icon = m.speed === "fast" ? Zap : m.speed === "deep" ? Sparkles : Brain;
            return (
              <button
                key={m.id}
                onClick={() => onChange(m.id)}
                className={`panel flex w-full items-start gap-3 p-4 text-left transition ${
                  active ? "border-primary/60 bg-[oklch(0.76_0.16_62_/_0.12)]" : ""
                }`}
              >
                <div
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-[oklch(1_0_0_/_0.06)] text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-base font-bold">{m.name}</div>
                    {m.thinking && (
                      <span className="pill bg-[oklch(0.76_0.16_62_/_0.2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--ember)]">
                        Thinking
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{m.tagline}</div>
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
                {active && <Check className="h-5 w-5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Brain, ChevronDown } from "lucide-react";

export function ThinkingPanel({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = useState(live);
  useEffect(() => {
    if (live) setOpen(true);
  }, [live]);

  return (
    <div className="thinking-panel overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="tap flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <Brain className="h-4 w-4 shrink-0 text-[color:var(--signal)]" />
        <span className={`text-[13px] font-semibold ${live ? "shimmer-text" : ""}`}>
          {live ? "Reasoning…" : "Reasoning trace"}
        </span>
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && text && (
        <div className="border-t border-[oklch(0.8_0.12_190_/_0.2)] px-3.5 py-3">
          <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-6 text-muted-foreground">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

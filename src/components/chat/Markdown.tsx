import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((s, i) => {
        if (/^\*\*[^*]+\*\*$/.test(s)) return <strong key={i}>{s.slice(2, -2)}</strong>;
        if (/^`[^`]+`$/.test(s))
          return (
            <code
              key={i}
              className="rounded bg-[oklch(1_0_0_/_0.08)] px-1 py-0.5 font-mono text-[0.85em]"
            >
              {s.slice(1, -1)}
            </code>
          );
        return <span key={i}>{s}</span>;
      })}
    </>
  );
}

export function CodeBlock({ lang, path, code }: { lang: string; path?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-[oklch(0_0_0_/_0.4)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {path || lang || "code"}
        </span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="tap shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="max-h-[320px] overflow-auto p-3 font-mono text-[11.5px] leading-5">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Small, dependency-free markdown renderer for chat answers. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const chunks = text.split(/```([^\n`]*)\n?([\s\S]*?)```/g);
  const out: React.ReactNode[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (i % 3 === 0) {
      const block = chunks[i];
      if (!block?.trim()) continue;
      block.split(/\n{2,}/).forEach((para, k) => {
        const lines = para.split("\n");
        const isList = lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l) || !l.trim());
        if (isList && lines.some((l) => l.trim())) {
          out.push(
            <ul key={`${i}-${k}`} className="my-2 space-y-1.5 pl-1">
              {lines
                .filter((l) => l.trim())
                .map((l, j) => (
                  <li key={j} className="flex gap-2 text-[15px] leading-6">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ember)]" />
                    <span>
                      <Inline text={l.replace(/^\s*([-*]|\d+\.)\s+/, "")} />
                    </span>
                  </li>
                ))}
            </ul>,
          );
          return;
        }
        if (/^#{1,4}\s/.test(para)) {
          out.push(
            <h3 key={`${i}-${k}`} className="mt-4 mb-1 text-[17px] font-bold">
              <Inline text={para.replace(/^#{1,4}\s/, "")} />
            </h3>,
          );
          return;
        }
        out.push(
          <p key={`${i}-${k}`} className="my-2 whitespace-pre-wrap text-[15px] leading-6">
            <Inline text={para} />
          </p>,
        );
      });
    } else if (i % 3 === 1) {
      const info = (chunks[i] || "").trim().split(/\s+/);
      const code = chunks[i + 1] ?? "";
      const path = info.slice(1).find((t) => /\.[a-z0-9]+$/i.test(t));
      out.push(<CodeBlock key={i} lang={info[0] || ""} path={path} code={code} />);
      i += 1;
    }
  }
  return <div className={cn("min-w-0", className)}>{out}</div>;
}

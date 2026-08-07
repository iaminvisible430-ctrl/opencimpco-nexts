import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { highlight } from "@/lib/highlight";
import { Reveal } from "./StreamReveal";
import { cn } from "@/lib/utils";

function Inline({ text, reveal }: { text: string; reveal?: boolean }) {
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
        return (
          <span key={i}>
            <Reveal text={s} active={reveal} />
          </span>
        );
      })}
    </>
  );
}


export function CodeBlock({
  lang,
  path,
  code,
  streaming,
}: {
  lang: string;
  path?: string;
  code: string;
  streaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-[oklch(0_0_0_/_0.4)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span
          className={cn(
            "truncate font-mono text-[11px]",
            streaming ? "shimmer-text font-semibold" : "text-muted-foreground",
          )}
        >
          {path || lang || "code"}
        </span>
        {streaming ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[color:var(--signal)]" />
        ) : (
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
        )}
      </div>
      <pre className="code-scroll max-h-[320px] overflow-auto p-3 font-mono text-[11.5px] leading-5">
        <code>{highlight(code, lang)}</code>
      </pre>
    </div>
  );
}

function fenceMeta(info: string) {
  const tokens = (info || "").trim().split(/\s+/).filter(Boolean);
  let lang = (tokens[0] || "").toLowerCase();
  let path = tokens
    .slice(1)
    .map((t) => t.replace(/^(file|title)=/, "").replace(/["']/g, ""))
    .find((t) => /\.[a-z0-9]+$/i.test(t));
  if (!path && /\.[a-z0-9]+$/i.test(lang)) {
    path = lang;
    lang = path.split(".").pop()!.toLowerCase();
  }
  return { lang, path };
}

/**
 * Small dependency-free markdown renderer.
 * Handles a still-open ``` fence so code renders live while streaming.
 */
export function Markdown({
  text,
  className,
  streaming,
}: {
  text: string;
  className?: string;
  streaming?: boolean;
}) {
  const out: React.ReactNode[] = [];
  let rest = text;
  let openBlock: { info: string; code: string } | null = null;

  const closedFences = rest.match(/```/g)?.length ?? 0;
  if (closedFences % 2 === 1) {
    const idx = rest.lastIndexOf("```");
    const tail = rest.slice(idx + 3);
    const nl = tail.indexOf("\n");
    openBlock = nl === -1 ? { info: tail, code: "" } : { info: tail.slice(0, nl), code: tail.slice(nl + 1) };
    rest = rest.slice(0, idx);
  }

  const chunks = rest.split(/```([^\n`]*)\n?([\s\S]*?)```/g);

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
      const { lang, path } = fenceMeta(chunks[i] || "");
      out.push(<CodeBlock key={i} lang={lang} path={path} code={chunks[i + 1] ?? ""} />);
      i += 1;
    }
  }

  if (openBlock) {
    const { lang, path } = fenceMeta(openBlock.info);
    out.push(
      <CodeBlock key="open" lang={lang} path={path} code={openBlock.code} streaming={streaming} />,
    );
  }

  return <div className={cn("min-w-0", className)}>{out}</div>;
}

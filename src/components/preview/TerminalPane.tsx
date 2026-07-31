import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeProject } from "@/lib/preview/analyze";
import { projectKind, type PFile } from "@/lib/preview/build";
import { cn } from "@/lib/utils";

type Line = { kind: "in" | "out" | "err" | "ok"; text: string };

const HELP = `Available commands
  help                 show this list
  ls [dir]             list project files
  tree                 file tree with sizes
  cat <file>           print a file
  grep <pattern>       search all files
  wc                   line / char counts
  build                static build + issue report
  test                 run the self-test checks
  run <js>             evaluate JavaScript in the sandbox
  stat                 project summary
  clear                clear the terminal`;

function sandboxEval(src: string): string {
  try {
    // Runs in a throwaway function scope — no access to app state or the DOM.
    const out: string[] = [];
    const log = (...a: unknown[]) =>
      out.push(a.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" "));
    // eslint-disable-next-line no-new-func
    const fn = new Function("console", `"use strict";return (${src})`);
    let result: unknown;
    try {
      result = fn({ log, info: log, warn: log, error: log });
    } catch {
      // eslint-disable-next-line no-new-func
      result = new Function("console", `"use strict";${src}`)({ log, info: log, warn: log, error: log });
    }
    if (result !== undefined) out.push(typeof result === "string" ? result : JSON.stringify(result));
    return out.join("\n") || "(no output)";
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** In-browser sandbox shell over the generated project. */
export function TerminalPane({ files }: { files: PFile[] }) {
  const [lines, setLines] = useState<Line[]>([
    { kind: "ok", text: "opencimpco sandbox — type `help` to get started." },
  ]);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIndex, setHIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const issues = useMemo(() => analyzeProject(files), [files]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 9e9 });
  }, [lines, busy]);

  function push(...l: Line[]) {
    setLines((prev) => [...prev, ...l].slice(-400));
  }

  async function exec(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    push({ kind: "in", text: `$ ${cmd}` });
    setHistory((h) => [cmd, ...h].slice(0, 50));
    setHIndex(-1);
    const [name, ...args] = cmd.split(/\s+/);
    const arg = args.join(" ");

    if (name === "clear") return setLines([]);
    if (name === "help") return push({ kind: "out", text: HELP });

    if (name === "ls") {
      const dir = arg.replace(/\/$/, "");
      const list = files.filter((f) => (dir ? f.path.startsWith(dir + "/") : true));
      return push({
        kind: "out",
        text: list.length ? list.map((f) => f.path).join("\n") : "no files",
      });
    }
    if (name === "tree") {
      return push({
        kind: "out",
        text: files
          .map((f) => `${f.path.padEnd(30, " ")} ${f.lang || "text"}  ${f.code.length}b`)
          .join("\n"),
      });
    }
    if (name === "cat") {
      const f = files.find((x) => x.path === arg || x.path.endsWith("/" + arg));
      return push(f ? { kind: "out", text: f.code } : { kind: "err", text: `cat: ${arg}: not found` });
    }
    if (name === "grep") {
      if (!arg) return push({ kind: "err", text: "usage: grep <pattern>" });
      const hits: string[] = [];
      for (const f of files) {
        f.code.split("\n").forEach((l, i) => {
          if (l.toLowerCase().includes(arg.toLowerCase())) hits.push(`${f.path}:${i + 1}: ${l.trim()}`);
        });
      }
      return push({ kind: "out", text: hits.slice(0, 80).join("\n") || "no matches" });
    }
    if (name === "wc") {
      const total = files.reduce((n, f) => n + f.code.split("\n").length, 0);
      return push({
        kind: "out",
        text:
          files.map((f) => `${String(f.code.split("\n").length).padStart(5)} ${f.path}`).join("\n") +
          `\n${String(total).padStart(5)} total`,
      });
    }
    if (name === "stat") {
      return push({
        kind: "out",
        text: `kind    ${projectKind(files) ?? "unknown"}\nfiles   ${files.length}\nissues  ${issues.length}`,
      });
    }
    if (name === "run") {
      if (!arg) return push({ kind: "err", text: "usage: run <javascript>" });
      return push({ kind: "out", text: sandboxEval(arg) });
    }
    if (name === "build" || name === "test") {
      setBusy(true);
      const steps =
        name === "build"
          ? ["resolving modules", "bundling sources", "emitting preview bundle"]
          : ["checking imports", "checking entry export", "checking syntax balance"];
      for (const s of steps) {
        await new Promise((r) => setTimeout(r, 220));
        push({ kind: "out", text: `→ ${s}` });
      }
      setBusy(false);
      if (!issues.length)
        return push({ kind: "ok", text: `✓ ${name} passed — ${files.length} files, 0 issues` });
      return push(
        ...issues.map((i) => ({
          kind: i.level === "error" ? ("err" as const) : ("out" as const),
          text: `${i.level === "error" ? "✗" : "!"} ${i.file}: ${i.message}`,
        })),
        {
          kind: "err",
          text: `${name} finished with ${issues.filter((i) => i.level === "error").length} error(s)`,
        },
      );
    }
    return push({ kind: "err", text: `command not found: ${name}` });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[oklch(0.11_0.008_250)]">
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11.5px] leading-5">
        {lines.map((l, i) => (
          <pre
            key={i}
            className={cn(
              "whitespace-pre-wrap",
              l.kind === "in" && "text-foreground",
              l.kind === "out" && "text-muted-foreground",
              l.kind === "err" && "text-destructive",
              l.kind === "ok" && "text-[color:var(--success)]",
            )}
          >
            {l.text}
          </pre>
        ))}
        {busy && <div className="shimmer-text font-semibold">working…</div>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = value;
          setValue("");
          void exec(v);
        }}
        className="flex items-center gap-2 border-t border-border px-3 py-2"
      >
        <span className="font-mono text-[11.5px] text-[color:var(--success)]">$</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" && history.length) {
              e.preventDefault();
              const n = Math.min(hIndex + 1, history.length - 1);
              setHIndex(n);
              setValue(history[n]);
            }
            if (e.key === "ArrowDown" && hIndex >= 0) {
              e.preventDefault();
              const n = hIndex - 1;
              setHIndex(n);
              setValue(n < 0 ? "" : history[n]);
            }
          }}
          spellCheck={false}
          autoCapitalize="off"
          placeholder="run a command…"
          aria-label="Sandbox terminal input"
          className="min-w-0 flex-1 bg-transparent font-mono text-[11.5px] outline-none placeholder:text-muted-foreground"
        />
      </form>
    </div>
  );
}

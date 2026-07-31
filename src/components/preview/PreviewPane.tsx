import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCode2,
  Monitor,
  RotateCw,
  Smartphone,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { buildPreviewDoc, projectKind, type PFile } from "@/lib/preview/build";
import { cn } from "@/lib/utils";

type LogLine = { level: string; text: string };
type Status = "loading" | "ok" | "error";

export function PreviewPane({
  files,
  className,
  defaultDevice = "desktop",
}: {
  files: PFile[];
  className?: string;
  defaultDevice?: "mobile" | "desktop";
}) {
  const [device, setDevice] = useState<"mobile" | "desktop">(defaultDevice);
  const runnable = projectKind(files) !== null;
  const [view, setView] = useState<"app" | "files" | "console">(runnable ? "app" : "files");
  const [nonce, setNonce] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const frame = useRef<HTMLIFrameElement>(null);

  const doc = useMemo(() => (runnable ? buildPreviewDoc(files) : ""), [files, runnable]);

  useEffect(() => {
    if (!runnable) return;
    setStatus("loading");
    setLogs([]);
    const t = setTimeout(() => setStatus((s) => (s === "loading" ? "error" : s)), 12000);
    return () => clearTimeout(t);
  }, [doc, nonce, runnable]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data;
      if (!d || d.source !== "oc-preview") return;
      if (d.type === "ready") setStatus("ok");
      if (d.type === "error") {
        setStatus("error");
        setLogs((l) => [...l, { level: "error", text: d.message }].slice(-60));
      }
      if (d.type === "console") setLogs((l) => [...l, { level: d.level, text: d.text }].slice(-60));
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const errorCount = logs.filter((l) => l.level === "error").length;

  function openInTab() {
    const blob = new Blob([doc], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  }

  return (
    <div className={cn("flex min-h-0 flex-col bg-background", className)}>
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2 scroll-none">
        {runnable && <StatusDot status={status} />}
        {runnable && (
          <Seg active={view === "app"} onClick={() => setView("app")}>
            App
          </Seg>
        )}
        <Seg active={view === "files"} onClick={() => setView("files")}>
          <FileCode2 className="h-3.5 w-3.5" /> {files.length} files
        </Seg>
        <Seg active={view === "console"} onClick={() => setView("console")}>
          <Terminal className="h-3.5 w-3.5" />
          {errorCount > 0 && <span className="text-destructive">{errorCount}</span>}
        </Seg>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {runnable && (
            <>
              <IconBtn
                label="Device"
                onClick={() => setDevice((d) => (d === "mobile" ? "desktop" : "mobile"))}
              >
                {device === "mobile" ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
              </IconBtn>
              <IconBtn label="Reload" onClick={() => setNonce((n) => n + 1)}>
                <RotateCw className="h-4 w-4" />
              </IconBtn>
              <IconBtn label="Open in new tab" onClick={openInTab}>
                <ExternalLink className="h-4 w-4" />
              </IconBtn>
            </>
          )}
        </div>
      </div>

      {view === "app" && runnable && (
        <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-[oklch(0.12_0.008_250)] p-1.5 sm:p-3">
          <iframe
            key={nonce}
            ref={frame}
            title="Live preview"
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            srcDoc={doc}
            className={cn(
              "h-full w-full rounded-xl border border-border bg-white shadow-2xl",
              device === "mobile" ? "max-w-[420px]" : "max-w-none",
            )}
          />
        </div>
      )}

      {view === "files" && <FileBrowser files={files} />}

      {view === "console" && (
        <div className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-5">
          {logs.length === 0 && <div className="text-muted-foreground">No output yet.</div>}
          {logs.map((l, i) => (
            <div
              key={i}
              className={cn(
                "border-b border-border/60 py-1",
                l.level === "error" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <span className="uppercase opacity-60">{l.level}</span> {l.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FileBrowser({ files }: { files: PFile[] }) {
  const [open, setOpen] = useState(files[0]?.path ?? "");
  const active = files.find((f) => f.path === open) ?? files[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2 scroll-none">
        {files.map((f) => (
          <button
            key={f.path}
            onClick={() => setOpen(f.path)}
            className={cn(
              "pill tap tap-press shrink-0 px-3 py-1 font-mono text-[11px]",
              f.path === active?.path
                ? "bg-primary text-primary-foreground"
                : "bg-[oklch(1_0_0_/_0.05)] text-muted-foreground",
            )}
          >
            {f.path}
          </button>
        ))}
      </div>
      {active && (
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="uppercase tracking-wider">{active.lang || "text"}</span>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(active.code).catch(() => {});
              toast.success("File copied");
            }}
            className="tap tap-press flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-[oklch(1_0_0_/_0.06)]"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
      )}
      <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-5">
        <code>{active?.code}</code>
      </pre>
    </div>
  );
}

function StatusDot({ status }: { status: Status }) {
  if (status === "ok")
    return (
      <span className="mr-1 flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[color:var(--success)]">
        <CheckCircle2 className="h-3.5 w-3.5" /> Live
      </span>
    );
  if (status === "error")
    return (
      <span className="mr-1 flex shrink-0 items-center gap-1 text-[11px] font-semibold text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" /> Issue
      </span>
    );
  return <span className="shimmer-text mr-1 shrink-0 text-[11px] font-semibold">Booting…</span>;
}

function Seg({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "pill tap tap-press flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold",
        active ? "bg-[oklch(1_0_0_/_0.1)] text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="tap tap-press grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[oklch(1_0_0_/_0.05)] text-muted-foreground hover:text-foreground"
    >
      {children}
    </button>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Database, Gauge, ScrollText, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  clearTable,
  createTable,
  dropTable,
  listTables,
  readTable,
  removeRow,
  setRow,
  type DbEvent,
} from "@/lib/preview/db-host";
import { getRequests, subscribeRequests, type AiRequest } from "@/lib/ai-telemetry";
import { cn } from "@/lib/utils";

export type PanelLog = { level: string; text: string };

type Tab = "db" | "ai" | "logs";

/**
 * BETA side panel that sits next to the preview: live project database, AI
 * telemetry and a merged log stream.
 */
export function SidePanel({
  project,
  chatId,
  modelLabel,
  provider,
  contextChars,
  logs,
  issues,
  dbEvents,
  dbVersion,
  onDbChange,
}: {
  project: string;
  chatId: string;
  modelLabel: string;
  provider: string;
  contextChars: number;
  logs: PanelLog[];
  issues: { level: string; file: string; message: string }[];
  dbEvents: DbEvent[];
  dbVersion: number;
  onDbChange: () => void;
}) {
  const [tab, setTab] = useState<Tab>("db");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <PanelTab active={tab === "db"} onClick={() => setTab("db")}>
          <Database className="h-3.5 w-3.5" /> Database
        </PanelTab>
        <PanelTab active={tab === "ai"} onClick={() => setTab("ai")}>
          <Gauge className="h-3.5 w-3.5" /> AI
        </PanelTab>
        <PanelTab active={tab === "logs"} onClick={() => setTab("logs")}>
          <ScrollText className="h-3.5 w-3.5" /> Logs
        </PanelTab>
        <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          beta
        </span>
      </div>

      {tab === "db" && (
        <DatabaseTab project={project} version={dbVersion} onChange={onDbChange} />
      )}
      {tab === "ai" && (
        <AiTab
          chatId={chatId}
          modelLabel={modelLabel}
          provider={provider}
          contextChars={contextChars}
        />
      )}
      {tab === "logs" && <LogsTab logs={logs} issues={issues} dbEvents={dbEvents} />}
    </div>
  );
}

function DatabaseTab({
  project,
  version,
  onChange,
}: {
  project: string;
  version: number;
  onChange: () => void;
}) {
  const tables = useMemo(() => listTables(project), [project, version]);
  const [active, setActive] = useState("");
  const table = active || tables[0] || "";
  const rows = useMemo(() => (table ? readTable(project, table) : []), [project, table, version]);
  const [draftId, setDraftId] = useState("");
  const [draftValue, setDraftValue] = useState("");

  function save(id: string, raw: string) {
    let value: unknown = raw;
    try {
      value = JSON.parse(raw);
    } catch {
      /* keep the raw string when it isn't JSON */
    }
    setRow(project, table, id, value);
    onChange();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2 scroll-none">
        {tables.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={cn(
              "pill tap tap-press shrink-0 px-3 py-1 font-mono text-[11px]",
              t === table
                ? "bg-primary text-primary-foreground"
                : "bg-[oklch(1_0_0_/_0.05)] text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => {
            const name = window.prompt("New table name")?.trim();
            if (!name) return;
            createTable(project, name);
            setActive(name);
            onChange();
          }}
          className="pill tap tap-press shrink-0 bg-[oklch(1_0_0_/_0.05)] px-2 py-1 text-[11px] text-muted-foreground"
          aria-label="New table"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            onClick={onChange}
            aria-label="Refresh"
            className="tap tap-press grid h-7 w-7 place-items-center rounded-lg bg-[oklch(1_0_0_/_0.05)] text-muted-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {table && (
            <button
              onClick={() => {
                dropTable(project, table);
                setActive("");
                onChange();
                toast.success(`Dropped ${table}`);
              }}
              aria-label="Drop table"
              className="tap tap-press grid h-7 w-7 place-items-center rounded-lg bg-[oklch(1_0_0_/_0.05)] text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {!table && (
        <div className="grid flex-1 place-items-center px-6 text-center text-[13px] text-muted-foreground">
          <div>
            <Database className="mx-auto mb-2 h-6 w-6 opacity-60" />
            No tables yet. They appear as soon as your app calls
            <span className="font-mono"> ocDB.set()</span>, or create one manually.
          </div>
        </div>
      )}

      {table && (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-mono">
              {table} · {rows.length} record{rows.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => {
                clearTable(project, table);
                onChange();
              }}
              className="tap underline-offset-2 hover:underline"
            >
              clear
            </button>
          </div>

          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-[oklch(1_0_0_/_0.03)] p-2">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="truncate font-mono text-[11px] text-[color:var(--signal)]">{r.id}</span>
                  <button
                    onClick={() => {
                      removeRow(project, table, r.id);
                      onChange();
                    }}
                    aria-label={`Delete ${r.id}`}
                    className="tap ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <textarea
                  defaultValue={JSON.stringify(r.value, null, 2)}
                  onBlur={(e) => save(r.id, e.target.value)}
                  spellCheck={false}
                  rows={Math.min(8, JSON.stringify(r.value, null, 2).split("\n").length)}
                  aria-label={`Value of ${r.id}`}
                  className="w-full resize-y rounded-lg bg-[oklch(0_0_0_/_0.35)] p-2 font-mono text-[11px] leading-5 outline-none"
                />
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-dashed border-border p-2">
            <div className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Insert record</div>
            <input
              value={draftId}
              onChange={(e) => setDraftId(e.target.value)}
              placeholder="id"
              aria-label="New record id"
              className="mb-1.5 w-full rounded-lg bg-[oklch(0_0_0_/_0.35)] px-2 py-1.5 font-mono text-[11px] outline-none"
            />
            <textarea
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              placeholder={`{ "title": "Buy milk", "done": false }`}
              rows={3}
              aria-label="New record value"
              className="w-full rounded-lg bg-[oklch(0_0_0_/_0.35)] p-2 font-mono text-[11px] outline-none"
            />
            <button
              onClick={() => {
                const id = draftId.trim() || String(Date.now());
                save(id, draftValue.trim() || "null");
                setDraftId("");
                setDraftValue("");
              }}
              className="pill tap tap-press mt-1.5 bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
            >
              Insert
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AiTab({
  chatId,
  modelLabel,
  provider,
  contextChars,
}: {
  chatId: string;
  modelLabel: string;
  provider: string;
  contextChars: number;
}) {
  const [reqs, setReqs] = useState<AiRequest[]>(() => getRequests(chatId));
  useEffect(() => subscribeRequests(() => setReqs(getRequests(chatId))), [chatId]);

  const ok = reqs.filter((r) => r.ok).length;
  const avg = reqs.length ? Math.round(reqs.reduce((n, r) => n + r.ms, 0) / reqs.length) : 0;

  return (
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Active model" value={modelLabel} />
        <Stat label="Provider" value={provider} />
        <Stat label="Context" value={`${(contextChars / 1000).toFixed(1)}k chars`} />
        <Stat label="Avg response" value={avg ? `${(avg / 1000).toFixed(1)}s` : "—"} />
        <Stat label="Requests" value={String(reqs.length)} />
        <Stat label="Succeeded" value={`${ok}/${reqs.length || 0}`} />
      </div>

      <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Request history
      </div>
      {reqs.length === 0 && (
        <div className="mt-2 text-[13px] text-muted-foreground">
          No requests yet this session — send a message to populate this panel.
        </div>
      )}
      <div className="mt-2 space-y-1.5">
        {reqs.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-[oklch(1_0_0_/_0.03)] px-2 py-1.5 font-mono text-[11px]"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                r.ok ? "bg-[color:var(--success)]" : "bg-destructive",
              )}
            />
            <span className="min-w-0 flex-1 truncate">{r.model}</span>
            <span className="shrink-0 text-muted-foreground">{(r.ms / 1000).toFixed(1)}s</span>
            <span className="shrink-0 text-muted-foreground">{(r.bytes / 1000).toFixed(1)}kB</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsTab({
  logs,
  issues,
  dbEvents,
}: {
  logs: PanelLog[];
  issues: { level: string; file: string; message: string }[];
  dbEvents: DbEvent[];
}) {
  const empty = !logs.length && !issues.length && !dbEvents.length;
  return (
    <div className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-5">
      {empty && <div className="text-muted-foreground">Nothing logged yet.</div>}
      {issues.map((i, k) => (
        <Row
          key={`i-${k}`}
          tone={i.level === "error" ? "err" : "warn"}
          tag={i.level}
          text={`${i.file}: ${i.message}`}
        />
      ))}
      {logs.map((l, k) => (
        <Row key={`l-${k}`} tone={l.level === "error" ? "err" : "muted"} tag={l.level} text={l.text} />
      ))}
      {dbEvents.map((e, k) => (
        <Row key={`d-${k}`} tone="db" tag="db" text={e.text} />
      ))}
    </div>
  );
}

function Row({ tone, tag, text }: { tone: "err" | "warn" | "muted" | "db"; tag: string; text: string }) {
  return (
    <div
      className={cn(
        "border-b border-border/60 py-1",
        tone === "err" && "text-destructive",
        tone === "warn" && "text-[color:var(--ember)]",
        tone === "muted" && "text-muted-foreground",
        tone === "db" && "text-[color:var(--signal)]",
      )}
    >
      <span className="uppercase opacity-60">{tag}</span> {text}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-[oklch(1_0_0_/_0.03)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-semibold">{value}</div>
    </div>
  );
}

function PanelTab({
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

/**
 * Host side of `ocDB`.
 *
 * The preview iframe is sandboxed with an opaque origin, so it cannot touch
 * `localStorage` itself — every read/write is proxied to the app window over
 * `postMessage`. This module owns that store so the Database panel and the
 * generated app always see exactly the same rows.
 */

const PREFIX = "oc-db";

export type DbRow = { id: string; value: unknown };
export type DbEvent = { at: number; text: string };

function tableKey(project: string, table: string) {
  return `${PREFIX}:${project}:${table}`;
}

export function listTables(project: string): string[] {
  if (typeof window === "undefined") return [];
  const head = `${PREFIX}:${project}:`;
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(head)) out.push(k.slice(head.length));
  }
  return out.sort();
}

function readRaw(project: string, table: string): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(tableKey(project, table)) || "{}") || {};
  } catch {
    return {};
  }
}

function writeRaw(project: string, table: string, obj: Record<string, unknown>) {
  localStorage.setItem(tableKey(project, table), JSON.stringify(obj));
}

export function readTable(project: string, table: string): DbRow[] {
  const obj = readRaw(project, table);
  return Object.keys(obj).map((id) => ({ id, value: obj[id] }));
}

export function setRow(project: string, table: string, id: string, value: unknown) {
  const obj = readRaw(project, table);
  obj[id] = value;
  writeRaw(project, table, obj);
}

export function removeRow(project: string, table: string, id: string) {
  const obj = readRaw(project, table);
  delete obj[id];
  writeRaw(project, table, obj);
}

export function clearTable(project: string, table: string) {
  writeRaw(project, table, {});
}

export function dropTable(project: string, table: string) {
  localStorage.removeItem(tableKey(project, table));
}

export function createTable(project: string, table: string) {
  if (!localStorage.getItem(tableKey(project, table))) writeRaw(project, table, {});
}

type Op = "get" | "set" | "list" | "remove" | "clear";

/**
 * Serve `ocDB` calls coming from the preview iframe. Returns a cleanup fn.
 * `onEvent` receives a human-readable line for the Logs tab.
 */
export function attachDbHost(
  project: string,
  onEvent: (e: DbEvent) => void,
  onChange: () => void,
): () => void {
  function handle(e: MessageEvent) {
    const d = e.data as
      | { source?: string; type?: string; rid?: number; op?: Op; table?: string; id?: string; value?: unknown }
      | null;
    if (!d || d.source !== "oc-preview" || d.type !== "db" || typeof d.rid !== "number") return;
    const table = d.table || "default";
    const reply = (payload: Record<string, unknown>) => {
      const target = e.source as WindowProxy | null;
      target?.postMessage({ source: "oc-db-host", rid: d.rid, ...payload }, "*");
    };

    try {
      let data: unknown = null;
      switch (d.op) {
        case "get":
          data = readRaw(project, table)[String(d.id)] ?? null;
          break;
        case "list":
          data = readTable(project, table).map((r) =>
            r.value && typeof r.value === "object" && !Array.isArray(r.value)
              ? { id: r.id, ...(r.value as Record<string, unknown>) }
              : { id: r.id, value: r.value },
          );
          break;
        case "set":
          setRow(project, table, String(d.id), d.value);
          data = d.value;
          break;
        case "remove":
          removeRow(project, table, String(d.id));
          data = true;
          break;
        case "clear":
          clearTable(project, table);
          data = true;
          break;
        default:
          reply({ ok: false, error: `unknown op: ${String(d.op)}` });
          return;
      }
      reply({ ok: true, data });
      onEvent({ at: Date.now(), text: `ocDB.${d.op}("${table}"${d.id != null && d.op !== "list" && d.op !== "clear" ? `, "${d.id}"` : ""})` });
      if (d.op === "set" || d.op === "remove" || d.op === "clear") onChange();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "db error";
      reply({ ok: false, error: msg });
      onEvent({ at: Date.now(), text: `ocDB.${String(d.op)} failed — ${msg}` });
    }
  }

  window.addEventListener("message", handle);
  return () => window.removeEventListener("message", handle);
}

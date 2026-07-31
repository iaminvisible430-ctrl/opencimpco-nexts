import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { Check, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import type { PFile } from "@/lib/preview/build";
import { cn } from "@/lib/utils";

const MONACO_LANG: Record<string, string> = {
  jsx: "javascript",
  tsx: "typescript",
  js: "javascript",
  ts: "typescript",
  css: "css",
  html: "html",
  json: "json",
  md: "markdown",
  python: "python",
  bash: "shell",
  yaml: "yaml",
  sql: "sql",
  go: "go",
  rust: "rust",
  java: "java",
  php: "php",
  cpp: "cpp",
  csharp: "csharp",
};

/**
 * Monaco-backed file editor. Edits are applied to the in-memory project so the
 * preview updates without asking the model to regenerate anything.
 */
export function CodeEditor({
  file,
  onSave,
  onReset,
  edited,
}: {
  file: PFile;
  onSave: (code: string) => void;
  onReset: () => void;
  edited: boolean;
}) {
  const [draft, setDraft] = useState(file.code);
  const [saved, setSaved] = useState(false);
  const path = useRef(file.path);

  useEffect(() => {
    if (path.current !== file.path) {
      path.current = file.path;
      setDraft(file.code);
      return;
    }
    setDraft(file.code);
  }, [file.path, file.code]);

  const dirty = draft !== file.code;

  function save() {
    onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
    toast.success(`Saved ${file.path}`);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="truncate font-mono">{file.path}</span>
        {edited && <span className="pill bg-[oklch(0.8_0.12_190_/_0.15)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--signal)]">edited</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {edited && (
            <button
              onClick={onReset}
              className="tap tap-press flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-[oklch(1_0_0_/_0.06)]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Revert
            </button>
          )}
          <button
            onClick={save}
            disabled={!dirty}
            className={cn(
              "tap tap-press flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold",
              dirty
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground opacity-60",
            )}
          >
            {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          theme="vs-dark"
          path={file.path}
          language={MONACO_LANG[file.lang] ?? "plaintext"}
          value={draft}
          onChange={(v) => setDraft(v ?? "")}
          options={{
            fontSize: 12,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            padding: { top: 10, bottom: 40 },
            automaticLayout: true,
            smoothScrolling: true,
            renderLineHighlight: "none",
          }}
          loading={<div className="shimmer-text p-4 text-xs font-semibold">Loading editor…</div>}
        />
      </div>
    </div>
  );
}

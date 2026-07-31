import { useRef } from "react";
import { ArrowUp, ChevronDown, Paperclip, Square, X } from "lucide-react";
import { toast } from "sonner";
import { getModel } from "@/lib/models";

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

export async function pickImages(files: FileList | null): Promise<string[]> {
  if (!files) return [];
  const out: string[] = [];
  for (const f of Array.from(files).slice(0, 4)) {
    if (!f.type.startsWith("image/")) continue;
    if (f.size > 4 * 1024 * 1024) {
      toast.error(`${f.name} is too large (max 4MB)`);
      continue;
    }
    out.push(await fileToDataUrl(f));
  }
  return out;
}

export function Attachments({
  items,
  onRemove,
  size = "md",
}: {
  items: string[];
  onRemove: (i: number) => void;
  size?: "sm" | "md";
}) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((a, i) => (
        <div key={i} className="relative">
          <img
            src={a}
            alt="attachment"
            className={`${size === "sm" ? "h-12 w-12" : "h-16 w-16"} rounded-lg border border-border object-cover`}
          />
          <button
            onClick={() => onRemove(i)}
            aria-label="Remove attachment"
            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Composer({
  value,
  onChange,
  attachments,
  onAttachments,
  modelId,
  onOpenModels,
  onSend,
  onStop,
  busy,
  placeholder = "Describe what to build, or paste an error…",
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  attachments: string[];
  onAttachments: (v: string[]) => void;
  modelId: string;
  onOpenModels: () => void;
  onSend: () => void;
  onStop?: () => void;
  busy: boolean;
  placeholder?: string;
  rows?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const model = getModel(modelId);

  return (
    <div className="panel p-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <Attachments
        items={attachments}
        size="sm"
        onRemove={(i) => onAttachments(attachments.filter((_, j) => j !== i))}
      />
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={onOpenModels}
            className="pill tap tap-press flex min-w-0 items-center gap-1.5 bg-[oklch(1_0_0_/_0.05)] px-3 py-1.5 text-xs"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--success)]" />
            <span className="truncate font-semibold">{model.name.replace("Opencimpco ", "")}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Attach image"
            className="tap tap-press grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[oklch(1_0_0_/_0.05)]"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const picked = await pickImages(e.target.files);
              onAttachments([...attachments, ...picked].slice(0, 4));
              e.target.value = "";
            }}
          />
        </div>
        {busy && onStop ? (
          <button
            onClick={onStop}
            aria-label="Stop"
            className="tap tap-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!value.trim() || busy}
            aria-label="Send"
            className="tap tap-press ember-glow grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <ArrowUp className="h-4.5 w-4.5" />
          </button>
        )}
      </div>
    </div>
  );
}

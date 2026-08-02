import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Github, Loader2, Rocket, ExternalLink, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { getGithubAccount, pushToGithub } from "@/lib/ship.functions";
import type { PFile } from "@/lib/preview/build";
import { cn } from "@/lib/utils";

/** Push the current project to GitHub and hand off to Vercel — no tokens to paste. */
export function ShipPanel({ files, suggestedName }: { files: PFile[]; suggestedName?: string }) {
  const account = useServerFn(getGithubAccount);
  const push = useServerFn(pushToGithub);

  const { data: acct, isLoading } = useQuery({
    queryKey: ["github-account"],
    queryFn: () => account({}),
    staleTime: 60_000,
  });

  const [repo, setRepo] = useState(
    (suggestedName ?? "opencimpco-app").toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40),
  );
  const [message, setMessage] = useState("Update from Opencimpco Code");
  const [isPrivate, setIsPrivate] = useState(false);
  const [result, setResult] = useState<{
    repoUrl: string;
    commitUrl: string;
    vercelUrl: string;
    fileCount: number;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      push({
        data: {
          repo,
          message,
          isPrivate,
          files: files.map((f) => ({ path: f.path, code: f.code })),
        },
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Pushed ${data.fileCount} files to ${repo}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Push failed"),
  });

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Rocket className="h-4 w-4 text-[color:var(--ember)]" />
        Ship this project
      </div>

      <div className="rounded-xl border border-border bg-[oklch(1_0_0_/_0.03)] p-3 text-xs">
        {isLoading ? (
          <span className="shimmer-text">Checking GitHub…</span>
        ) : acct?.connected ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Github className="h-3.5 w-3.5" />
            Connected as <span className="font-semibold text-foreground">{acct.login}</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--success)]" />
          </span>
        ) : (
          <span className="text-[color:var(--ember)]">
            GitHub isn&apos;t connected for this workspace yet. Ask the builder to connect it, then reload.
          </span>
        )}
      </div>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Repository name
        </span>
        <input
          value={repo}
          onChange={(e) => setRepo(e.target.value.replace(/\s+/g, "-"))}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
          placeholder="my-app"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Commit message
        </span>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
        />
      </label>

      <button
        type="button"
        onClick={() => setIsPrivate((p) => !p)}
        className={cn(
          "tap tap-press flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
          isPrivate ? "bg-primary text-primary-foreground" : "bg-[oklch(1_0_0_/_0.05)] text-muted-foreground",
        )}
      >
        <Lock className="h-3.5 w-3.5" /> {isPrivate ? "Private repo" : "Public repo"}
      </button>

      <button
        type="button"
        disabled={!acct?.connected || mutation.isPending || !repo || files.length === 0}
        onClick={() => mutation.mutate()}
        className="tap tap-press flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Pushing {files.length} files…
          </>
        ) : (
          <>
            <Github className="h-4 w-4" /> Push to GitHub
          </>
        )}
      </button>

      {result && (
        <div className="space-y-2 rounded-xl border border-border bg-[oklch(1_0_0_/_0.03)] p-3">
          <a
            href={result.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs font-semibold text-foreground hover:underline"
          >
            <Github className="h-3.5 w-3.5" /> {result.repoUrl.replace("https://github.com/", "")}
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
          <a
            href={result.vercelUrl}
            target="_blank"
            rel="noreferrer"
            className="tap tap-press flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
          >
            <Rocket className="h-4 w-4" /> Deploy to Vercel
          </a>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Vercel signs you in with your own account in a new tab — nothing is stored here.
          </p>
        </div>
      )}
    </div>
  );
}

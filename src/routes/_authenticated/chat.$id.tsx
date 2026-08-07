import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eye, MessageSquare, Share2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { getChat } from "@/lib/chats.functions";
import { getProfile } from "@/lib/profile.functions";
import { publishArtifact } from "@/lib/artifacts.functions";
import { DEFAULT_MODEL_ID, type CodexModelId } from "@/lib/models";
import { ModelSheet } from "@/components/ModelSheet";
import { MessageList, type ChatMessage } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { useChatStream } from "@/components/chat/useChatStream";
import { PreviewPane } from "@/components/preview/PreviewPane";
import { buildPreviewDoc, parseProjectFiles, projectKind, type PFile } from "@/lib/preview/build";
import { parseFileDeletions } from "@/lib/preview/files";

import { analyzeProject } from "@/lib/preview/analyze";
import { loadOverrides } from "@/lib/preview/overrides";
import { buildProjectContext } from "@/lib/prompt";
import { filesToBlocks, type ImportedFile } from "@/lib/import-files";
import { parseThinking } from "@/lib/parse-thinking";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/chat/$id")({
  validateSearch: z.object({ auto: z.number().optional() }),
  component: ChatPage,
});

function useIsWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return wide;
}

function ChatPage() {
  const { id } = Route.useParams();
  const { auto } = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();
  const getChatFn = useServerFn(getChat);
  const getProfileFn = useServerFn(getProfile);
  const publishFn = useServerFn(publishArtifact);
  const wide = useIsWide();

  const { data } = useQuery({ queryKey: ["chat", id], queryFn: () => getChatFn({ data: { id } }) });
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [sources, setSources] = useState<ImportedFile[]>([]);
  const [modelId, setModelId] = useState<CodexModelId>(DEFAULT_MODEL_ID);
  const [modelOpen, setModelOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "preview">("chat");
  const scroller = useRef<HTMLDivElement>(null);
  const autoRan = useRef(false);
  // Latest project snapshot + issues, sent with each request so the model edits
  // instead of regenerating.
  const contextRef = useRef("");
  const filesRef = useRef<PFile[]>([]);


  const onDone = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["chat", id] }),
      qc.invalidateQueries({ queryKey: ["profile"] }),
    ]);
  }, [id, qc]);
  const { streaming, error, run, stop } = useChatStream(id, onDone);

  useEffect(() => {
    if (data?.chat.model) setModelId(data.chat.model as CodexModelId);
  }, [data?.chat.model]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 9e9 });
  }, [data?.messages?.length, streaming]);

  useEffect(() => {
    if (!auto || autoRan.current || !data) return;
    const last = data.messages[data.messages.length - 1];
    if (last?.role === "user") {
      autoRan.current = true;
      run((data.chat.model as CodexModelId) || DEFAULT_MODEL_ID, contextRef.current, filesRef.current);
      nav({ to: "/chat/$id", params: { id }, search: {}, replace: true });
    }
  }, [auto, data, id, nav, run]);

  async function send() {
    const content = input.trim();
    if (!content || streaming !== null) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) throw new Error("Session expired");
      const persisted =
        content +
        filesToBlocks(sources) +
        (attachments.length ? "\n" + attachments.map((a) => `[[img:${a}]]`).join("\n") : "");
      const { error: insertError } = await supabase.from("messages").insert({
        chat_id: id,
        user_id: sess.session.user.id,
        role: "user",
        content: persisted,
      });
      if (insertError) throw insertError;
      setInput("");
      setAttachments([]);
      setSources([]);
      setTab("chat");
      await qc.invalidateQueries({ queryKey: ["chat", id] });
      await run(modelId, contextRef.current, filesRef.current);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "failed to send");
    }
  }


  const messages: ChatMessage[] = useMemo(() => {
    const base = (data?.messages ?? []) as ChatMessage[];
    if (streaming === null) return base;
    return [
      ...base,
      { id: "__stream__", role: "assistant", content: streaming, created_at: new Date().toISOString() },
    ];
  }, [data, streaming]);

  const project = useMemo(() => {
    // Merge every turn so earlier files stay in the project when a later message
    // only re-emits what changed. User turns are included so imported .zip /
    // source files land in the preview, editor and terminal immediately.
    const merged = new Map<string, PFile>();
    for (const m of messages) {
      const { visible } = parseThinking(m.content);
      for (const f of parseProjectFiles(visible)) merged.set(f.path, f);
      // Files the agent deleted with delete_file.
      for (const path of parseFileDeletions(visible)) merged.delete(path);
    }
    // Manual editor edits win over anything the model wrote.
    const edits = loadOverrides(id);
    for (const [path, code] of Object.entries(edits) as [string, string][]) {
      const existing = merged.get(path);
      if (existing) merged.set(path, { ...existing, code });
    }
    const files = [...merged.values()];
    if (!files.length) return null;
    return { files, kind: projectKind(files) };
  }, [messages, id]);

  const issues = useMemo(() => (project ? analyzeProject(project.files) : []), [project]);

  // Keep the request context fresh without re-creating send()/run() callbacks.
  useEffect(() => {
    contextRef.current = project ? buildProjectContext(project.files, issues, []) : "";
    filesRef.current = project ? project.files : [];
  }, [project, issues]);



  const publish = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("Nothing to publish yet");
      return publishFn({
        data: {
          title: data?.chat.title?.slice(0, 80) || "Untitled project",
          kind: "html",
          code: buildPreviewDoc(project.files),
        },
      });
    },
    onSuccess: (r) => {
      const url = `${window.location.origin}/projects/${r.slug}`;
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Published — link copied", { description: url });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const showChat = wide || tab === "chat" || !project;
  const showPreview = !!project && (wide || tab === "preview");

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-2 py-2 lg:px-4">
        <button
          onClick={() => nav({ to: "/chats" })}
          aria-label="Back"
          className="tap tap-press grid h-9 w-9 place-items-center rounded-lg hover:bg-[oklch(1_0_0_/_0.06)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold">{data?.chat.title ?? "Chat"}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {(profile?.credits ?? 0).toLocaleString()} credits
            {project ? ` · ${project.files.length} files` : ""}
          </div>
        </div>
        {project && (
          <button
            onClick={() => publish.mutate()}
            disabled={publish.isPending}
            className="pill tap tap-press flex shrink-0 items-center gap-1.5 bg-[oklch(1_0_0_/_0.06)] px-3 py-1.5 text-xs font-semibold"
          >
            <Share2 className="h-3.5 w-3.5" /> Publish
          </button>
        )}
      </header>

      {project && (
        <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 lg:hidden">
          <Tab active={tab === "chat"} onClick={() => setTab("chat")}>
            <MessageSquare className="h-4 w-4" /> Chat
          </Tab>
          <Tab active={tab === "preview"} onClick={() => setTab("preview")}>
            <Eye className="h-4 w-4" /> Preview
          </Tab>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-row">
        {showChat && (
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-col",
              showPreview ? "w-full lg:w-[420px] lg:shrink-0 lg:border-r lg:border-border xl:w-[480px]" : "flex-1",
            )}
          >
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className={cn("mx-auto w-full", showPreview ? "" : "max-w-3xl")}>
                <MessageList messages={messages} />
                {error && (
                  <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>

            <div className="safe-bottom border-t border-border p-2.5">
              <div className={cn("mx-auto w-full", showPreview ? "" : "max-w-3xl")}>
                <Composer
                  value={input}
                  onChange={setInput}
                  attachments={attachments}
                  onAttachments={setAttachments}
                  sources={sources}
                  onSources={setSources}
                  projectFiles={project?.files.map((f) => f.path) ?? []}
                  modelId={modelId}
                  onOpenModels={() => setModelOpen(true)}
                  onSend={send}
                  onStop={stop}
                  busy={streaming !== null}
                  placeholder="Ask for a change, a fix, or a new screen…"
                />
              </div>
            </div>
          </div>
        )}

        {showPreview && project && (
          <PreviewPane
            files={project.files}
            defaultDevice={wide ? "desktop" : "mobile"}
            className="min-h-0 min-w-0 flex-1"
            chatId={id}
            modelLabel={getModel(modelId).name}
            provider={getModel(modelId).provider}
            contextChars={contextRef.current.length}
          />
        )}

      </div>

      <ModelSheet
        open={modelOpen}
        onClose={() => setModelOpen(false)}
        value={modelId}
        onChange={(v: CodexModelId) => {
          setModelId(v);
          setModelOpen(false);
        }}
      />
    </div>
  );
}

function Tab({
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
        "pill tap tap-press flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold",
        active ? "bg-[oklch(1_0_0_/_0.1)] text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

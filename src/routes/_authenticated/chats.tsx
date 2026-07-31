import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listChats, deleteChat, renameChat } from "@/lib/chats.functions";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/chats")({
  component: ChatsPage,
});

function ChatsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listChats);
  const delFn = useServerFn(deleteChat);
  const renFn = useServerFn(renameChat);
  const { data: chats } = useQuery({ queryKey: ["chats"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chats"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const ren = useMutation({
    mutationFn: (v: { id: string; title: string }) => renFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chats"] });
      setEditing(null);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black tracking-tight">Your chats</h1>
        <button
          onClick={() => nav({ to: "/home" })}
          className="pill flex items-center gap-2 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground ember-glow"
        >
          <Plus className="h-4 w-4" /> New
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {(chats ?? []).length === 0 && (
          <div className="panel p-6 text-center text-muted-foreground">
            No chats yet. Start one from the home tab.
          </div>
        )}
        {chats?.map((c) => (
          <div key={c.id} className="panel flex items-center gap-3 p-4">
            {editing === c.id ? (
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => ren.mutate({ id: c.id, title: title || c.title })}
                onKeyDown={(e) => e.key === "Enter" && ren.mutate({ id: c.id, title: title || c.title })}
                className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none"
              />
            ) : (
              <Link
                to="/chat/$id"
                params={{ id: c.id }}
                className="min-w-0 flex-1"
              >
                <div className="truncate text-base font-semibold">{c.title}</div>
                <div className="text-xs text-muted-foreground">
                  Opencimpco Code · {new Date(c.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </Link>
            )}
            <button
              onClick={() => {
                setEditing(c.id);
                setTitle(c.title);
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-[oklch(1_0_0_/_0.06)]"
              aria-label="Rename"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => confirm("Delete this chat?") && del.mutate(c.id)}
              className="grid h-9 w-9 place-items-center rounded-full text-destructive hover:bg-[oklch(1_0_0_/_0.06)]"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

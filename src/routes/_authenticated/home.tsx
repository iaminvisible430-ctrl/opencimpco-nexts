import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Gift, Globe, Layout, Smartphone, Wrench } from "lucide-react";
import { getProfile, claimDaily } from "@/lib/profile.functions";
import { createChat } from "@/lib/chats.functions";
import { DEFAULT_MODEL_ID, type CodexModelId } from "@/lib/models";
import { ModelSheet } from "@/components/ModelSheet";
import { Composer } from "@/components/chat/Composer";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Build — Opencimpco Code" },
      {
        name: "description",
        content:
          "Start a new build: describe an app, attach a screenshot, and get multi-file React or HTML with a live preview.",
      },
      { property: "og:title", content: "Build — Opencimpco Code" },
      {
        property: "og:description",
        content: "Describe an app and get working multi-file code with a live preview.",
      },
    ],
  }),
  component: HomePage,
});

const STARTERS = [
  { icon: Layout, label: "Landing page", prompt: "Build a modern SaaS landing page in React with a hero, feature grid, pricing and footer." },
  { icon: Smartphone, label: "Mobile app UI", prompt: "Build a multi-file React habit tracker app UI with a list, add form and stats card." },
  { icon: Wrench, label: "Fix my code", prompt: "Here is my code, find the bug and return the fixed files:\n\n" },
  { icon: Globe, label: "Research + build", prompt: "Search the web for the latest CSS view-transition API usage, then build a demo page using it." },
];

function useCountdown(last?: string | null) {
  const [countdown, setCountdown] = useState<string | null>(null);
  useEffect(() => {
    if (!last) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const diff = 24 * 3600 * 1000 - (Date.now() - new Date(last).getTime());
      if (diff <= 0) return setCountdown(null);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [last]);
  return countdown;
}

function HomePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const getProfileFn = useServerFn(getProfile);
  const claimFn = useServerFn(claimDaily);
  const createFn = useServerFn(createChat);

  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });

  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [modelId, setModelId] = useState<CodexModelId>(DEFAULT_MODEL_ID);
  const [modelOpen, setModelOpen] = useState(false);
  const countdown = useCountdown(profile?.last_daily_claim);

  const claim = useMutation({
    mutationFn: () => claimFn(),
    onSuccess: (r) => {
      if (r.ok) toast.success("+3,000 credits");
      else toast.info("Come back later to claim");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: (content: string) => createFn({ data: { content, model: modelId, attachments } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["chats"] });
      nav({ to: "/chat/$id", params: { id: r.chatId }, search: { auto: 1 } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const displayName = profile?.display_name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greet =
    hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <section>
        <p className="text-[13px] font-medium text-muted-foreground">
          {greet}, {displayName}
        </p>
        <h1 className="mt-1 text-[34px] font-bold leading-[1.05] lg:text-[52px]">
          Ship something
          <br />
          <span className="gradient-text">real today.</span>
        </h1>

      </section>

      <Composer
        value={prompt}
        onChange={setPrompt}
        attachments={attachments}
        onAttachments={setAttachments}
        modelId={modelId}
        onOpenModels={() => setModelOpen(true)}
        onSend={() => prompt.trim() && create.mutate(prompt.trim())}
        busy={create.isPending}
        rows={4}
        placeholder="Describe the app you want. Attach a screenshot to clone a design…"
      />

      <section>
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Quick starts
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {STARTERS.map(({ icon: Icon, label, prompt: p }) => (
            <button
              key={label}
              onClick={() => setPrompt(p)}
              className="panel tap tap-press flex flex-col items-start gap-2 p-3.5 text-left"
            >
              <Icon className="h-4.5 w-4.5 text-[color:var(--ember)]" />
              <span className="text-[13.5px] font-semibold leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3.5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[oklch(1_0_0_/_0.06)]">
          <Gift className="h-[18px] w-[18px] text-[color:var(--ember)]" />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold">Daily credits</div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            {countdown ? `Next drop in ${countdown}` : "3,000 credits waiting"}
          </div>
        </div>
        <button
          disabled={!!countdown || claim.isPending}
          onClick={() => claim.mutate()}
          className="pill tap tap-press shrink-0 bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
        >
          Claim
        </button>
      </section>

      <ModelSheet
        open={modelOpen}
        onClose={() => setModelOpen(false)}
        value={modelId}
        onChange={(id: CodexModelId) => {
          setModelId(id);
          setModelOpen(false);
        }}
      />
    </div>
  );
}

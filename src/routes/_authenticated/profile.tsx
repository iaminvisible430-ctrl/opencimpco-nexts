import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { LogOut, Moon } from "lucide-react";
import { getProfile, updateDisplayName } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { CODEX_MODELS } from "@/lib/models";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const getProfileFn = useServerFn(getProfile);
  const updateFn = useServerFn(updateDisplayName);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });

  const [name, setName] = useState("");
  useEffect(() => {
    if (profile?.display_name) setName(profile.display_name);
  }, [profile?.display_name]);

  const save = useMutation({
    mutationFn: (display_name: string) => updateFn({ data: { display_name } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="panel flex items-center gap-4 p-4">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[color:var(--signal)] to-[color:var(--signal)] text-lg font-bold text-white">
          {(profile?.display_name || profile?.email || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{profile?.display_name || "—"}</div>
          <div className="truncate text-sm text-muted-foreground">{profile?.email || "guest account"}</div>
        </div>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-[color:var(--signal)] to-[color:var(--ember)] p-5 text-primary-foreground ember-glow">
        <div className="text-xs font-bold tracking-widest opacity-80">CREDIT BALANCE</div>
        <div className="mt-1 text-5xl font-black">{(profile?.credits ?? 0).toLocaleString()}</div>
        <div className="mt-2 text-sm opacity-80">Claim 3,000 more every 24 hours on the home tab.</div>
      </div>

      <div className="panel p-4">
        <div className="mb-2 text-base font-bold">Display name</div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-full border border-border bg-[oklch(1_0_0_/_0.03)] px-4 py-3 text-sm outline-none"
          />
          <button
            onClick={() => save.mutate(name)}
            disabled={save.isPending || !name.trim()}
            className="pill bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      <div className="panel flex items-center gap-3 p-4">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-[oklch(1_0_0_/_0.06)]">
          <Moon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-bold">Dark mode</div>
          <div className="text-xs text-muted-foreground">Easier on the eyes at night.</div>
        </div>
        <div className="pill flex h-7 w-12 items-center bg-primary p-1">
          <div className="ml-auto h-5 w-5 rounded-full bg-primary-foreground" />
        </div>
      </div>

      <div className="panel p-4">
        <div className="mb-3 text-base font-bold">Model pricing</div>
        <div className="space-y-3">
          {CODEX_MODELS.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{m.name}</div>
                <div className="truncate text-xs text-muted-foreground">{m.tagline}</div>
              </div>
              <div className="pill shrink-0 bg-[oklch(1_0_0_/_0.06)] px-3 py-1 text-xs font-semibold">
                {m.cost}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={signOut}
        className="pill flex w-full items-center justify-center gap-2 border border-destructive/60 py-3.5 text-sm font-semibold text-destructive"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

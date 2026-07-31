import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Opencimpco Code" },
      { name: "description", content: "Create your Opencimpco Code account and get 10,000 free credits for AI coding." },
      { property: "og:title", content: "Sign in — Opencimpco Code" },
      { property: "og:description", content: "Your AI vibe coding assistant." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace("/home");
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split("@")[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Welcome! You got 10,000 free credits.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      window.location.replace("/home");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message || "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    window.location.replace("/home");
  }

  async function guest() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInAnonymously({
        options: { data: { display_name: "Guest" } },
      });
      if (error) throw error;
      window.location.replace("/home");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start guest session");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center px-6 pb-10 pt-14">
      <Logo className="h-20 w-20 ember-glow" />
      <h1 className="mt-6 text-4xl font-black tracking-tight">
        Opencimpco <span className="gradient-text">Code</span>
      </h1>
      <p className="mt-3 text-center text-[15px] leading-6 text-muted-foreground">
        Your AI vibe coding assistant. Sign up and get{" "}
        <span className="font-semibold text-[color:var(--success)]">10,000 free credits</span>.
      </p>

      <div className="panel mt-8 w-full p-4">
        <div className="pill flex bg-[oklch(1_0_0_/_0.04)] p-1">
          <button
            className={`pill flex-1 py-2.5 text-sm font-semibold transition ${mode === "signup" ? "bg-[oklch(1_0_0_/_0.08)] text-foreground" : "text-muted-foreground"}`}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
          <button
            className={`pill flex-1 py-2.5 text-sm font-semibold transition ${mode === "signin" ? "bg-[oklch(1_0_0_/_0.08)] text-foreground" : "text-muted-foreground"}`}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <Field label="Display name">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Opencimpco"
                className="input-base"
              />
            </Field>
          )}
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-base"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-base"
            />
          </Field>
          <button
            disabled={loading}
            className="pill mt-2 w-full bg-primary py-3.5 text-base font-semibold text-primary-foreground ember-glow transition hover:opacity-95 disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={google}
          disabled={loading}
          className="pill flex w-full items-center justify-center gap-3 border border-border bg-[oklch(1_0_0_/_0.03)] py-3.5 text-base font-semibold transition hover:bg-[oklch(1_0_0_/_0.06)] disabled:opacity-60"
        >
          <GoogleG /> Continue with Google
        </button>
      </div>

      <button
        onClick={guest}
        disabled={loading}
        className="mt-6 text-[15px] font-semibold text-foreground/90 underline-offset-4 hover:underline"
      >
        Continue as guest (1,000 credits)
      </button>

      <style>{`
        .input-base {
          width: 100%;
          border-radius: 999px;
          padding: 14px 18px;
          background: oklch(1 0 0 / 0.03);
          border: 1px solid var(--color-border);
          color: var(--color-foreground);
          font-size: 15px;
          outline: none;
          transition: border-color .15s, background .15s;
        }
        .input-base:focus { border-color: var(--ember); background: oklch(1 0 0 / 0.05); }
      `}</style>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        By continuing you agree to Opencimpco Code terms. <Link to="/" className="underline">Home</Link>
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-[15px] font-semibold">{label}</div>
      {children}
    </label>
  );
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C33.8 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.3 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C33.8 6.1 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.1 0 9.7-2 13.2-5.2l-6.1-5c-2 1.4-4.5 2.2-7.1 2.2-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.8l6.1 5C40.3 35.3 44 30.1 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

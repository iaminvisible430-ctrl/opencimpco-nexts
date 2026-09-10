import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Boxes,
  CheckCircle2,
  Circle,
  Cpu,
  Database,
  GitBranch,
  Layers,
  Smartphone,
  Sparkles,
  Terminal,
} from "lucide-react";

export const Route = createFileRoute("/agent/new")({
  head: () => ({
    meta: [
      { title: "Agent handoff — OpenMatrix Agent build guide" },
      {
        name: "description",
        content:
          "What OpenMatrix Agent is, how it is built, how to clone or remix it, and the exact remaining phases the next agent should finish.",
      },
      { property: "og:title", content: "Agent handoff — OpenMatrix Agent build guide" },
      {
        property: "og:description",
        content:
          "Architecture, conventions and the remaining roadmap for whoever continues building OpenMatrix Agent.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Agent handoff — OpenMatrix Agent build guide" },
      {
        name: "twitter:description",
        content:
          "Architecture, conventions and the remaining roadmap for whoever continues building OpenMatrix Agent.",
      },
    ],
  }),
  component: AgentHandoff,
});

const DONE = [
  "Streaming chat with live reasoning, blur-to-sharp reveal and syntax-highlighted code as it arrives",
  "Agent activity timeline: search, read, write, edit, rename, install, command, lint, format, index, docs, build, check — each shimmering while it runs",
  "In-request virtual workspace so edits are surgical patches, not full rewrites",
  "Live preview with Babel compile, pinned CDN dependencies (Lucide, charts, motion, 3D and more), Monaco editor and a sandbox terminal",
  "Side panel: database CRUD (ocDB bridge), AI request telemetry and unified logs",
  "Multi-provider model catalog (Lovable AI, OpenRouter, Groq, Mistral, Qwen, Cohere, Cerebras, Google, Hugging Face, Cloudflare, Bazaarlink) with OCR fallback for text-only models",
  "Ship flow: GitHub commit and Vercel deploy, plus an API proxy for generated apps",
];

const REMAINING = [
  {
    icon: Layers,
    title: "Phase A — Deep tool library",
    body: "Grow the toolkit toward a few hundred tested actions: multi-hunk patching, dependency graph queries, migrations, screenshot diffing across viewports, test scaffolding and self-repair loops. Quality over raw count.",
  },
  {
    icon: Smartphone,
    title: "Phase B — Mobile (APK) builds",
    body: "Generate a Capacitor shell (config, icons, splash, permissions) from any preview project and export a ready-to-build Android project as a downloadable archive.",
  },
  {
    icon: Sparkles,
    title: "Phase C — Full UI redesign",
    body: "Premium AI-IDE shell: refreshed typography and iconography, file-tree with live click-through, shimmer edit overlays, resizable panes, command palette.",
  },
  {
    icon: Database,
    title: "Phase D — Backend in previews",
    body: "Real auth, database, storage and secret handling inside generated previews, carried over when the project ships.",
  },
  {
    icon: GitBranch,
    title: "Phase E — Community templates",
    body: "Browsable template gallery with remix-in-one-tap, plus automated screenshot capture and per-viewport comparison before publishing.",
  },
];

const MAP = [
  { path: "src/routes/api/chat.ts", what: "Streaming endpoint, virtual workspace and the whole tool suite" },
  { path: "src/lib/models.ts", what: "Model catalog: provider, tools, vision, thinking, cost, group" },
  { path: "src/lib/ai-gateway.server.ts", what: "Provider resolution and the vision/OCR fallback pipeline" },
  { path: "src/lib/prompt.ts", what: "System prompt: response protocol and design system" },
  { path: "src/lib/agent-steps.ts", what: "Activity markers -> timeline steps (start/end pairs drive the shimmer)" },
  { path: "src/lib/preview/", what: "File parsing, project analysis, preview bundler and the ocDB bridge" },
  { path: "src/components/preview/", what: "Preview pane, Monaco editor, terminal, ship and side panels" },
];

function AgentHandoff() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <Link to="/" className="text-[13px] font-semibold text-muted-foreground">
        ← Back to the app
      </Link>

      <span className="pill mt-4 inline-flex bg-[oklch(0.8_0.12_190_/_0.16)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--signal)]">
        Handoff · Beta
      </span>
      <h1 className="mt-3 text-3xl font-bold leading-tight">OpenMatrix Agent — agent handoff</h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
        OpenMatrix Agent is a mobile-first AI app builder: you describe an app, a model writes it
        with real tools, and the result compiles into a live preview with its own database, terminal
        and publish flow. This page is written for the next agent picking the work up — what exists,
        how it fits together, and what is still open.
      </p>

      <Section icon={Cpu} title="How it works">
        <p className="text-[14.5px] leading-7 text-muted-foreground">
          The chat endpoint streams reasoning, text and tool activity over one plain-text response.
          Tools operate on an in-request virtual workspace seeded with the project's current files,
          so a model can read, patch, rename and verify individual files instead of rewriting
          everything. Changed files are appended to the transcript as code blocks, which the preview
          parser turns back into a project tree, compiles in the browser with Babel, and renders in a
          sandboxed frame. Storage and AI calls inside that frame are proxied to the host.
        </p>
      </Section>

      <Section icon={CheckCircle2} title="Already shipped">
        <ul className="space-y-2">
          {DONE.map((d) => (
            <li key={d} className="flex gap-2.5 text-[14.5px] leading-7 text-muted-foreground">
              <CheckCircle2 className="mt-1.5 h-4 w-4 shrink-0 text-[color:var(--success)]" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Boxes} title="Where the code lives">
        <div className="space-y-2">
          {MAP.map((m) => (
            <div key={m.path} className="rounded-xl border border-border p-3">
              <code className="font-mono text-[12.5px] text-foreground">{m.path}</code>
              <p className="mt-1 text-[13.5px] leading-6 text-muted-foreground">{m.what}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Terminal} title="How to clone and continue">
        <ol className="space-y-2 text-[14.5px] leading-7 text-muted-foreground">
          <li>
            <strong className="text-foreground">1. Remix the project.</strong> Open the project menu
            and choose Remix — you get the full codebase in a new project of your own.
          </li>
          <li>
            <strong className="text-foreground">2. Add the provider keys.</strong> Each provider
            needs its own key stored as a backend secret; models whose key is missing fail with a
            readable message instead of breaking the app.
          </li>
          <li>
            <strong className="text-foreground">3. Keep the streaming contract.</strong> Activity
            markers come in start/end pairs; the timeline shimmers anything still unpaired. New tools
            just need a marker entry and an icon.
          </li>
          <li>
            <strong className="text-foreground">4. Verify with a real run.</strong> Send a build
            request through the app, watch the timeline, then check the preview, terminal and data
            panels before shipping a phase.
          </li>
          <li>
            <strong className="text-foreground">5. Work phase by phase.</strong> Finish one phase
            below, test it live, then move on.
          </li>
        </ol>
      </Section>

      <Section icon={Circle} title="Remaining phases">
        <div className="space-y-3">
          {REMAINING.map((r) => (
            <div key={r.title} className="rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2">
                <r.icon className="h-4 w-4 text-[color:var(--signal)]" />
                <h3 className="text-[15px] font-semibold">{r.title}</h3>
              </div>
              <p className="mt-1.5 text-[14px] leading-6 text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Cpu;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <Icon className="h-4.5 w-4.5 text-[color:var(--signal)]" />
        {title}
      </h2>
      {children}
    </section>
  );
}

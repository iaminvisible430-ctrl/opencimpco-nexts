import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import whatsNew from "@/assets/whats-new.jpg";

/** Bump this when the next batch of features ships — everyone sees the card once. */
const RELEASE = "beta-2026-09-1";
const KEY = `om.whatsnew.${RELEASE}`;

const FEATURES = [
  "Live activity: every file read, edit, command and build shimmers while it runs",
  "Reasoning streams as it happens — no more silent waiting",
  "Bazaarlink models back online, including a free one and native vision",
  "Previews now load pinned Lucide icons, charts, motion and 25+ libraries",
  "Built-in database, AI telemetry and logs panel beside the preview",
];

export function WhatsNew() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      // private mode — just skip the card
    }
  }, []);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-3 backdrop-blur-sm sm:place-items-center">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="relative">
          <img
            src={whatsNew}
            alt="Preview of the new OpenMatrix agent activity and preview panels"
            width={1280}
            height={720}
            className="h-40 w-full object-cover"
          />
          <button
            onClick={close}
            aria-label="Close"
            className="tap tap-press absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[color:var(--signal)]" />
            <span className="pill bg-[oklch(0.8_0.12_190_/_0.16)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--signal)]">
              Update · Beta
            </span>
          </div>
          <h2 className="text-xl font-bold leading-tight">You just got new features</h2>
          <ul className="space-y-1.5 text-[13.5px] leading-6 text-muted-foreground">
            {FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--signal)]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            <button
              onClick={close}
              className="tap tap-press flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Start building
            </button>
            <Link
              to="/agent/new"
              onClick={close}
              className="tap tap-press rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
            >
              Roadmap
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

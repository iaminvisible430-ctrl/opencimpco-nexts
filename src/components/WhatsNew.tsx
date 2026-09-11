import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import whatsNew from "@/assets/whats-new.jpg";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

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

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-md gap-0 overflow-y-auto rounded-lg border-border bg-card p-0 shadow-2xl">
        <div className="relative">
          <img
            src={whatsNew}
            alt="Preview of the new OpenMatrix agent activity and preview panels"
            width={1280}
            height={720}
            loading="lazy"
            className="h-40 w-full object-cover"
          />
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[color:var(--signal)]" />
            <span className="pill bg-[oklch(0.8_0.12_190_/_0.16)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--signal)]">
              Update · Beta
            </span>
          </div>
          <DialogTitle className="text-xl font-bold leading-tight">You just got new features</DialogTitle>
          <DialogDescription className="sr-only">
            A summary of the newest OpenMatrix Agent beta improvements.
          </DialogDescription>
          <ul className="space-y-1.5 text-[13.5px] leading-6 text-muted-foreground">
            {FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--signal)]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            <Button onClick={close} className="tap tap-press flex-1">
              Start building
            </Button>
            <Button asChild variant="outline" className="tap tap-press">
              <Link to="/agent/new" onClick={close}>Roadmap</Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

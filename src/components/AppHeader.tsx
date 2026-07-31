import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { Logo } from "./Logo";
import { getProfile } from "@/lib/profile.functions";

export function AppHeader() {
  const getProfileFn = useServerFn(getProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });

  const initial = (profile?.display_name || profile?.email || "?").slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur-xl">
      <Link to="/home" className="flex min-w-0 items-center gap-2.5">
        <Logo className="h-8 w-8" />
        <div className="min-w-0">
          <div className="truncate font-display text-[15px] font-bold leading-tight">
            Opencimpco <span className="gradient-text">Code</span>
          </div>
          <div className="truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            build · preview · ship
          </div>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <div className="pill hairline flex items-center gap-1.5 bg-[oklch(1_0_0_/_0.04)] px-2.5 py-1.5 text-[13px] font-semibold">
          <Zap className="h-3.5 w-3.5 text-[color:var(--ember)]" />
          {(profile?.credits ?? 0).toLocaleString()}
        </div>
        <Link
          to="/profile"
          aria-label="Profile"
          className="tap tap-press grid h-9 w-9 place-items-center rounded-xl bg-secondary text-sm font-bold"
        >
          {initial}
        </Link>
      </div>
    </header>
  );
}

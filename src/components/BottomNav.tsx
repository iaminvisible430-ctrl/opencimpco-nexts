import { Link, useLocation } from "@tanstack/react-router";
import { Home, Layers, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/home", label: "Build", icon: Home, match: (p: string) => p === "/home" },
  {
    to: "/chats",
    label: "Projects",
    icon: Layers,
    match: (p: string) => p.startsWith("/chats") || p.startsWith("/chat/"),
  },
  { to: "/profile", label: "You", icon: User, match: (p: string) => p === "/profile" },
] as const;

export function BottomNav() {
  const loc = useLocation();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto grid max-w-2xl grid-cols-3 px-2 pt-1.5">
        {items.map(({ to, label, icon: Icon, match }) => {
          const active = match(loc.pathname);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "tap tap-press flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-14 place-items-center rounded-full transition",
                  active ? "bg-[oklch(1_0_0_/_0.08)]" : "",
                )}
              >
                <Icon
                  className={cn("h-[18px] w-[18px]", active && "text-[color:var(--ember)]")}
                />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

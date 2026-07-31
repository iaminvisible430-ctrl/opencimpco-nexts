import { createFileRoute, Outlet, redirect, useMatchRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const matchRoute = useMatchRoute();
  // The chat workspace is a full-screen surface with its own header; the app
  // chrome would overlap it.
  const fullScreen = Boolean(matchRoute({ to: "/chat/$id", fuzzy: false }));

  if (fullScreen) return <Outlet />;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <AppHeader />
      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}


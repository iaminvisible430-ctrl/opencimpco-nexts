import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Opencimpco Code — AI coding, live preview, publish" },
      {
        name: "description",
        content:
          "Mobile-first AI coding assistant with deep thinking, streaming responses, image attachments and live React / HTML preview.",
      },
      { property: "og:title", content: "Opencimpco Code — AI coding, live preview, publish" },
      {
        property: "og:description",
        content: "Mobile-first AI coding assistant with deep thinking, streaming responses, image attachments and live React / HTML preview.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace("/home");
      else window.location.replace("/auth");
    });
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Logo className="h-16 w-16 animate-pulse" />
    </div>
  );
}

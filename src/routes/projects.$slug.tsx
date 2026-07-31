import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { buildReactPreview } from "@/lib/parse-artifacts";

const getPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const supa = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
    );
    const { data: row, error } = await supa
      .from("artifacts")
      .select("title,kind,code,created_at")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    return row as { title: string; kind: "html" | "react"; code: string; created_at: string };
  });

export const Route = createFileRoute("/projects/$slug")({
  loader: async ({ params }) => {
    const row = await getPublic({ data: { slug: params.slug } });
    if (!row) throw notFound();
    return row;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — Opencimpco Code` : "Not found" },
      {
        name: "description",
        content: loaderData
          ? `Live preview of ${loaderData.title} — published on Opencimpco Code.`
          : "Not found",
      },
      { property: "og:title", content: loaderData?.title ?? "Opencimpco Code" },
      {
        property: "og:description",
        content: loaderData
          ? `Live preview of ${loaderData.title} — published on Opencimpco Code.`
          : "Published on Opencimpco Code.",
      },
    ],
  }),
  component: PublicPreview,
});

function PublicPreview() {
  const row = Route.useLoaderData();
  const src = row.kind === "react" ? buildReactPreview(row.code) : row.code;
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[color:var(--success)]" />
          <span className="font-semibold">{row.title}</span>
        </div>
        <a href="/" className="text-xs text-muted-foreground hover:text-foreground">
          Made with Opencimpco Code →
        </a>
      </div>
      <iframe
        title={row.title}
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
        srcDoc={src}
        className="flex-1 border-0 bg-white"
      />
    </div>
  );
}

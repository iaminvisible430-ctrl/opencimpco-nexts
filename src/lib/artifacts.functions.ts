import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "artifact";
  const rnd = Math.random().toString(36).slice(2, 7);
  return `${base}-${rnd}`;
}

export const publishArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(1).max(80),
        kind: z.enum(["html", "react"]),
        code: z.string().min(1).max(200000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const slug = slugify(data.title);
    const { data: row, error } = await context.supabase
      .from("artifacts")
      .insert({
        user_id: context.userId,
        slug,
        title: data.title,
        kind: data.kind,
        code: data.code,
      })
      .select("slug")
      .single();
    if (error) throw error;
    return { slug: row.slug };
  });

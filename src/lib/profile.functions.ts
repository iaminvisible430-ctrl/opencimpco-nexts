import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      // First-touch: create profile
      const { data: created, error: cerr } = await context.supabase
        .from("profiles")
        .insert({ id: context.userId, credits: 10000 })
        .select()
        .single();
      if (cerr) throw cerr;
      return created;
    }
    return data;
  });

export const updateDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ display_name: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ display_name: data.display_name })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const claimDaily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("credits,last_daily_claim")
      .eq("id", context.userId)
      .single();
    if (error) throw error;
    const now = Date.now();
    if (profile.last_daily_claim) {
      const diff = now - new Date(profile.last_daily_claim).getTime();
      if (diff < 24 * 3600 * 1000) {
        const remaining = 24 * 3600 * 1000 - diff;
        return { ok: false, remaining };
      }
    }
    const newCredits = (profile.credits ?? 0) + 3000;
    const { error: uerr } = await context.supabase
      .from("profiles")
      .update({ credits: newCredits, last_daily_claim: new Date().toISOString() })
      .eq("id", context.userId);
    if (uerr) throw uerr;
    return { ok: true, credits: newCredits };
  });

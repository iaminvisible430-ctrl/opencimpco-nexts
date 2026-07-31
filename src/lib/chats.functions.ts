import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listChats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chats")
      .select("id,title,model,created_at,updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const getChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: chat, error } = await context.supabase
      .from("chats")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw error;
    const { data: messages, error: merr } = await context.supabase
      .from("messages")
      .select("id,role,content,created_at")
      .eq("chat_id", data.id)
      .order("created_at", { ascending: true });
    if (merr) throw merr;
    return { chat, messages };
  });

export const renameChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("chats")
      .update({ title: data.title })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("chats")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const createChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        content: z.string().min(1).max(20000),
        model: z.string().default("nemotron-super"),
        attachments: z.array(z.string()).default([]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const title = data.content.slice(0, 60);
    const { data: chat, error } = await context.supabase
      .from("chats")
      .insert({ user_id: context.userId, title, model: data.model })
      .select("id")
      .single();
    if (error) throw error;

    const persisted =
      data.content +
      (data.attachments.length
        ? "\n" + data.attachments.map((a) => `[[img:${a}]]`).join("\n")
        : "");

    await context.supabase.from("messages").insert({
      chat_id: chat.id,
      user_id: context.userId,
      role: "user",
      content: persisted,
    });
    return { chatId: chat.id as string };
  });

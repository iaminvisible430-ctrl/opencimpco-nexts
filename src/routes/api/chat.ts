import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText, streamText, tool, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL_ID, getModel } from "@/lib/models";
import { splitAttachments } from "@/lib/parse-thinking";


import { SYSTEM_PROMPT } from "@/lib/prompt";



const Body = z.object({
  chatId: z.string().uuid(),
  model: z.string().default(DEFAULT_MODEL_ID),
  /** Live project files + detected issues, injected so edits are surgical. */
  context: z.string().max(120_000).optional(),
});


function isNewKey(k: string) {
  return k.startsWith("sb_publishable_") || k.startsWith("sb_secret_");
}
function supaFetch(key: string): typeof fetch {
  return (input, init) => {
    const h = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => h.set(k, v));
    if (isNewKey(key) && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
    h.set("apikey", key);
    return fetch(input, { ...init, headers: h });
  };
}

/** Lightweight real-time web search (DuckDuckGo, no API key). */
async function webSearch(query: string) {
  const results: { title: string; snippet: string; url: string }[] = [];
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { headers: { "user-agent": "Mozilla/5.0 (compatible; OpencimpcoCode/1.0)" } },
    );
    const html = await res.text();
    const re =
      /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    const strip = (s: string) =>
      s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
    while ((m = re.exec(html)) && results.length < 5) {
      results.push({ url: strip(m[1]), title: strip(m[2]), snippet: strip(m[3]).slice(0, 320) });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "search failed", results };
  }
  return { results };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = Body.parse(await request.json());
          const model = getModel(body.model);


          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
          const token = auth.slice(7);
          if (token.split(".").length !== 3) return new Response("Unauthorized", { status: 401 });

          const url = process.env.SUPABASE_URL!;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const supabase = createClient(url, key, {
            global: { fetch: supaFetch(key), headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          });
          const claims = await supabase.auth.getClaims(token);
          const userId = claims.data?.claims?.sub;
          if (!userId) return new Response("Unauthorized", { status: 401 });

          const { data: ownedChat, error: chatError } = await supabase
            .from("chats")
            .select("id")
            .eq("id", body.chatId)
            .eq("user_id", userId)
            .single();
          if (chatError || !ownedChat) return new Response("Chat not found", { status: 404 });

          const { data: profile, error: perr } = await supabase
            .from("profiles")
            .select("credits")
            .eq("id", userId)
            .single();
          if (perr) return new Response(perr.message, { status: 500 });
          if ((profile.credits ?? 0) < model.cost) {
            return new Response(
              `Not enough credits. You need ${model.cost} but have ${profile.credits}. Claim daily reward for +3,000.`,
              { status: 402 },
            );
          }

          const { data: history } = await supabase
            .from("messages")
            .select("role,content")
            .eq("chat_id", body.chatId)
            .order("created_at", { ascending: true });

          const { resolveModel, resolveOcrModel } = await import("@/lib/ai-gateway.server");

          /**
           * Text-only models still need to "see" attachments, so transcribe them
           * with a vision model and inline the transcript as text.
           */
          async function ocr(images: string[]): Promise<string> {
            const ocrModel = resolveOcrModel();
            if (!ocrModel) return "";
            try {
              const { text } = await generateText({
                model: ocrModel,
                maxOutputTokens: 1200,
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: "Transcribe and describe these attachments for a text-only coding model. Include: every readable word (exact error messages, labels, code), the layout/structure, colours, fonts and spacing. Be dense and factual, no preamble.",
                      },
                      ...images.map((u) => ({ type: "image" as const, image: new URL(u) })),
                    ],
                  },
                ],
              });
              return text.trim();
            } catch {
              return "";
            }
          }

          const messages: ModelMessage[] = [];
          for (const m of history ?? []) {
            const { text, images } = splitAttachments(m.content);
            if (m.role === "user" && images.length) {
              if (model.vision) {
                messages.push({
                  role: "user",
                  content: [
                    { type: "text", text: text || " " },
                    ...images.map((u) => ({ type: "image" as const, image: new URL(u) })),
                  ],
                } as ModelMessage);
              } else {
                const transcript = await ocr(images);
                messages.push({
                  role: "user",
                  content:
                    (text || " ") +
                    (transcript
                      ? `\n\n[attachment OCR — ${images.length} image(s)]\n${transcript}`
                      : `\n\n[attachment OCR unavailable — ${images.length} image(s) attached]`),
                } as ModelMessage);
              }
              continue;
            }
            const content = text || m.content;
            if (!content?.trim()) continue;
            messages.push({ role: m.role as "user" | "assistant", content } as ModelMessage);
          }

          if (!messages.length) return new Response("No messages to send", { status: 400 });

          let languageModel;
          try {
            languageModel = resolveModel(model);
          } catch (e) {
            return new Response(e instanceof Error ? e.message : "model unavailable", { status: 500 });
          }


          const result = streamText({
            model: languageModel,
            system: body.context ? `${SYSTEM_PROMPT}\n\n${body.context}` : SYSTEM_PROMPT,
            messages,
            stopWhen: stepCountIs(model.tools ? 50 : 1),
            // Third-party providers default to huge budgets that some accounts cannot afford,
            // and Groq's free tier rejects large per-request token budgets outright.
            ...(model.providerKey === "lovable"
              ? {}
              : { maxOutputTokens: model.providerKey === "groq" ? 3500 : 8000 }),
            ...(model.thinking && model.providerKey === "openrouter"
              ? { providerOptions: { openrouter: { reasoning: { effort: "medium" } } } }
              : {}),

            ...(model.tools
              ? {
                  tools: {
                    web_search: tool({
                      description:
                        "Search the live web for current documentation, APIs, news or facts. Returns up to 5 results with title, snippet and URL.",
                      inputSchema: z.object({ query: z.string() }),
                      execute: async ({ query }) => webSearch(query),
                    }),
                  },
                }
              : {}),
          });

          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              let full = "";
              let reasoningOpen = false;
              const push = (s: string) => {
                full += s;
                controller.enqueue(encoder.encode(s));
              };
              try {
                for await (const part of result.fullStream) {
                  if (part.type === "reasoning-delta") {
                    // Surface upstream reasoning tokens in the app's thinking panel.
                    if (!reasoningOpen) {
                      reasoningOpen = true;
                      push("<thinking>");
                    }
                    push(part.text);
                  } else if (part.type === "text-delta") {
                    if (reasoningOpen) {
                      reasoningOpen = false;
                      push("</thinking>\n\n");
                    }
                    push(part.text);
                  } else if (part.type === "tool-call") {
                    const q = (part.input as { query?: string })?.query ?? "";
                    push(`\n\n[[oc:search:${q.replace(/[\]\n]/g, " ")}]]\n\n`);
                  } else if (part.type === "error") {
                    const err = part.error;
                    push(`\n\n[error] ${err instanceof Error ? err.message : String(err)}`);
                  }
                }
                if (reasoningOpen) push("</thinking>\n\n");
              } catch (e) {
                const msg = e instanceof Error ? e.message : "stream error";
                push(`\n\n[error] ${msg}`);
              }
              try {
                // Persist before closing the response stream. The client refetches as
                // soon as the stream closes, so closing first creates a race where the
                // streamed answer is removed before this row exists.
                const { error: messageError } = await supabase.from("messages").insert({
                  chat_id: body.chatId,
                  user_id: userId,
                  role: "assistant",
                  content: full || "(no response)",
                });
                if (messageError) throw messageError;

                const { error: chatUpdateError } = await supabase
                  .from("chats")
                  .update({ updated_at: new Date().toISOString(), model: model.id })
                  .eq("id", body.chatId)
                  .eq("user_id", userId);
                if (chatUpdateError) throw chatUpdateError;

                const { error: creditError } = await supabase
                  .from("profiles")
                  .update({ credits: (profile.credits ?? 0) - model.cost })
                  .eq("id", userId);
                if (creditError) throw creditError;
              } catch (e) {
                console.error("[/api/chat persist]", e);
                push("\n\n[error] The answer could not be saved. Please copy it before retrying.");
              } finally {
                controller.close();
              }
            },
          });


          return new Response(stream, {
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "no-cache, no-transform",
              "x-accel-buffering": "no",
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "error";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});

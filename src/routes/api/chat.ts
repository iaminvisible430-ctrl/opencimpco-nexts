import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText, tool, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL_ID, getModel } from "@/lib/models";
import { splitAttachments } from "@/lib/parse-thinking";


const SYSTEM_PROMPT = `You are Opencimpco Code — an elite AI software engineer that plans, researches, writes and tests complete, runnable projects. You behave like a senior full-stack engineer pair-programming with the user.

## Response protocol (strict)

1. ALWAYS open with a <thinking>...</thinking> block: your plan, the files you will create, risks, and how you'll verify it. 3-7 short lines. This is rendered in a separate reasoning panel.
2. After </thinking>, write a very short intro (1-2 sentences), then a compact **Plan** list of the steps you are taking.
3. Then output the code as one fenced block PER FILE, with the file path in the info string. Multi-file output is expected — split components, styles, utilities and tests into their own files:

\`\`\`jsx src/App.jsx
export default function App() { ... }
\`\`\`
\`\`\`jsx src/components/Card.jsx
export default function Card() { ... }
\`\`\`
\`\`\`css src/styles.css
.card { ... }
\`\`\`

4. Close with a short **How to verify** list (2-4 bullets) describing what the user should see in the preview.

## Preview runtime contract (must follow or the preview breaks)

- React projects: the entry file is \`src/App.jsx\` and MUST \`export default\` a component. Extra files are supported and are imported with RELATIVE paths including the extension-less form (\`./components/Card\`).
- React and ReactDOM 18 are provided. \`import React from "react"\` and hooks are supported. Other npm packages are auto-loaded from a CDN (esm.sh) — prefer zero dependencies, and only use small popular ones when needed.
- Styling: Tailwind CSS (CDN) is available in the preview, plus any \`.css\` files you emit.
- Do NOT emit \`src/main.jsx\`, \`index.html\`, package.json, vite config or install instructions for React projects — the runtime mounts \`src/App.jsx\` for you.
- Static projects: emit \`index.html\` (+ optional \`styles.css\`, \`script.js\`). Do not mix React and static HTML in the same answer.
- Never use browser-only APIs at module top level that would crash on first render; guard them inside effects.

## Other languages

- You also write Python, TypeScript, Node, Go, Rust, Java, SQL, shell and config files. Always give each file a real path in the fence info string (e.g. \`\`\`python app/main.py). These are not executed in the preview but are shown in the file browser with syntax-friendly formatting, so they must still be complete and runnable locally, with a short run command in the closing section.

## Engineering rules

- Small, focused components in separate files. Real, production-quality content — no lorem ipsum, no TODO placeholders, no truncated code with "...".
- Mobile-first, responsive, accessible (labels, alt text, focus states).
- Include realistic sample data so the preview looks alive on first render.
- When iterating, re-emit ONLY the files that changed — previously emitted files are preserved in the project.
- When the user reports a preview error, fix the root cause and re-emit only the affected files.

## Tools

- \`web_search\`: use it whenever the request depends on current facts, recent library APIs, pricing, docs or news. Search first, then build, and mention what you learned in one line.`;


const Body = z.object({
  chatId: z.string().uuid(),
  model: z.string().default(DEFAULT_MODEL_ID),
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

          const messages: ModelMessage[] = (history ?? [])
            .map((m) => {
              const { text, images } = splitAttachments(m.content);
              if (m.role === "user" && images.length) {
                return {
                  role: "user",
                  content: [
                    { type: "text", text: text || " " },
                    ...images.map((u) => ({ type: "image" as const, image: new URL(u) })),
                  ],
                } as ModelMessage;
              }
              return {
                role: m.role as "user" | "assistant",
                content: text || m.content,
              } as ModelMessage;
            })
            .filter((m) => (typeof m.content === "string" ? m.content.trim().length > 0 : true));

          if (!messages.length) return new Response("No messages to send", { status: 400 });

          const { resolveModel } = await import("@/lib/ai-gateway.server");
          let languageModel;
          try {
            languageModel = resolveModel(model);
          } catch (e) {
            return new Response(e instanceof Error ? e.message : "model unavailable", { status: 500 });
          }

          const result = streamText({
            model: languageModel,
            system: SYSTEM_PROMPT,
            messages,
            stopWhen: stepCountIs(model.tools ? 5 : 1),
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
                      inputSchema: z.object({ query: z.string().min(2).max(200) }),
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
                    push(`\n\n> 🔎 Searching the web: _${q}_\n\n`);
                  } else if (part.type === "error") {
                    const err = part.error;
                    push(`\n\n[error] ${err instanceof Error ? err.message : String(err)}`);
                  }
                }
                if (reasoningOpen) push("</thinking>\n\n");
                controller.close();
              } catch (e) {
                const msg = e instanceof Error ? e.message : "stream error";
                push(`\n\n[error] ${msg}`);
                controller.close();
              }
              try {
                await supabase.from("messages").insert({
                  chat_id: body.chatId,
                  user_id: userId,
                  role: "assistant",
                  content: full || "(no response)",
                });
                await supabase
                  .from("chats")
                  .update({ updated_at: new Date().toISOString(), model: model.id })
                  .eq("id", body.chatId);
                await supabase
                  .from("profiles")
                  .update({ credits: (profile.credits ?? 0) - model.cost })
                  .eq("id", userId);
              } catch (e) {
                console.error("[/api/chat persist]", e);
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

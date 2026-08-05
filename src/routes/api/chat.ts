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
  /** Structured project snapshot the file tools operate on. */
  files: z
    .array(z.object({ path: z.string(), lang: z.string().default(""), code: z.string() }))
    .max(200)
    .optional(),
});

const UA = "Mozilla/5.0 (compatible; OpenMatrixAgent/1.0)";

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
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "user-agent": UA },
    });
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

/** Fetch a page and return readable text so the agent can read docs it found. */
async function fetchPage(url: string) {
  try {
    if (!/^https?:\/\//i.test(url)) return { error: "Only http(s) URLs are supported" };
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) return { error: `Fetch failed (${res.status})` };
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    return { url, text: text.slice(0, 12_000) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "fetch failed" };
  }
}

const EXT_LANG: Record<string, string> = {
  jsx: "jsx",
  tsx: "tsx",
  js: "js",
  ts: "ts",
  css: "css",
  html: "html",
  json: "json",
  md: "md",
  py: "python",
  sql: "sql",
  sh: "bash",
};

function langOf(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANG[ext] ?? ext;
}

type VFile = { code: string; lang: string };

/** In-memory project the file tools operate on for the duration of one request. */
class Workspace {
  files = new Map<string, VFile>();
  changed = new Set<string>();
  deleted = new Set<string>();

  constructor(seed: { path: string; lang: string; code: string }[] = []) {
    for (const f of seed) this.files.set(f.path, { code: f.code, lang: f.lang || langOf(f.path) });
  }

  list() {
    return [...this.files.keys()].sort();
  }
  read(path: string) {
    const f = this.files.get(path);
    return f ? { path, code: f.code } : { error: `No such file: ${path}` };
  }
  write(path: string, code: string) {
    this.files.set(path, { code, lang: langOf(path) });
    this.changed.add(path);
    this.deleted.delete(path);
    return { ok: true, path, bytes: code.length };
  }
  edit(path: string, find: string, replace: string) {
    const f = this.files.get(path);
    if (!f) return { error: `No such file: ${path}. Use write_file to create it.` };
    const first = f.code.indexOf(find);
    if (first === -1)
      return {
        error: `The snippet was not found in ${path} verbatim. Call read_file first and copy an exact snippet.`,
      };
    if (f.code.indexOf(find, first + find.length) !== -1)
      return { error: `The snippet appears more than once in ${path}. Include more surrounding context.` };
    const code = f.code.slice(0, first) + replace + f.code.slice(first + find.length);
    this.files.set(path, { code, lang: f.lang });
    this.changed.add(path);
    return { ok: true, path, bytes: code.length };
  }
  remove(path: string) {
    if (!this.files.has(path)) return { error: `No such file: ${path}` };
    this.files.delete(path);
    this.changed.delete(path);
    this.deleted.add(path);
    return { ok: true, path };
  }

  /** Cheap static review so the agent can self-test without a real build. */
  check() {
    const problems: string[] = [];
    const paths = new Set(this.files.keys());
    const react = [...paths].some((p) => /\.(jsx|tsx)$/.test(p));
    if (react && !paths.has("src/App.jsx") && !paths.has("src/App.tsx")) {
      problems.push("Missing entry file src/App.jsx (or src/App.tsx) with `export default`.");
    }
    for (const [path, f] of this.files) {
      if (!/\.(jsx|tsx|js|ts)$/.test(path)) continue;
      const open = (f.code.match(/\{/g) ?? []).length;
      const close = (f.code.match(/\}/g) ?? []).length;
      if (open !== close) problems.push(`${path}: unbalanced braces (${open} '{' vs ${close} '}').`);
      if (/\bTODO\b|\.\.\. *rest|rest unchanged/i.test(f.code))
        problems.push(`${path}: contains a placeholder or TODO — emit the complete file.`);
      const re = /from\s+['"](\.[^'"]+)['"]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(f.code))) {
        const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
        const parts = dir ? dir.split("/") : [];
        for (const seg of m[1].split("/")) {
          if (seg === "." || seg === "") continue;
          if (seg === "..") parts.pop();
          else parts.push(seg);
        }
        const base = parts.join("/");
        const found = ["", ".jsx", ".tsx", ".ts", ".js", ".css", "/index.jsx", "/index.tsx", "/index.js"].some(
          (s) => paths.has(base + s),
        );
        if (!found) problems.push(`${path}: import "${m[1]}" does not resolve to an emitted file.`);
      }
      if (/export\s+default/.test(f.code) === false && /^src\/App\.(jsx|tsx)$/.test(path))
        problems.push(`${path}: no \`export default\` — the preview cannot mount it.`);
    }
    return problems.length ? { ok: false, problems } : { ok: true, problems: [] as string[] };
  }
}

/** Fenced blocks for the files the tools changed, so the client applies them. */
function changeBlocks(ws: Workspace): string {
  const parts: string[] = [];
  for (const path of ws.changed) {
    const f = ws.files.get(path);
    if (!f) continue;
    parts.push(`\`\`\`${f.lang || "text"} ${path}\n${f.code.replace(/\n?$/, "\n")}\`\`\``);
  }
  for (const path of ws.deleted) parts.push(`[[oc:rm:${path}]]`);
  return parts.length ? `\n\n${parts.join("\n\n")}\n` : "";
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

          // The chosen model first, then rescue models on independent providers so a
          // provider running out of credits never stalls the build.
          const chain: CodexModel[] = [];
          for (const candidate of modelChain(model.id)) {
            try {
              chain.push({ ...candidate, resolved: resolveModel(candidate) } as CodexModel & {
                resolved: LanguageModel;
              });
            } catch {
              // provider key missing — skip it silently
            }
          }
          if (!chain.length) {
            return new Response("No AI provider is configured for this model.", { status: 500 });
          }

          const ws = new Workspace(body.files ?? []);
          const system = body.context ? `${SYSTEM_PROMPT}\n\n${body.context}` : SYSTEM_PROMPT;

          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              let full = "";
              const push = (s: string) => {
                full += s;
                controller.enqueue(encoder.encode(s));
              };
              const marker = (kind: string, label: string) =>
                push(`\n\n[[oc:${kind}:${String(label).replace(/[\]\n]/g, " ").slice(0, 120)}]]\n\n`);
              const result = (ok: boolean, label = "") =>
                push(`[[oc:${ok ? "ok" : "err"}:${String(label).replace(/[\]\n]/g, " ").slice(0, 120)}]]\n\n`);

              /** Wrap a tool so every call opens a timeline row and closes it with ok/err. */
              function traced<I>(
                kind: string,
                label: (i: I) => string,
                run: (i: I) => Promise<Record<string, unknown>>,
              ) {
                return async (input: I) => {
                  marker(kind, label(input));
                  const out = await run(input);
                  result(!("error" in out), typeof out.error === "string" ? out.error : "");
                  return out;
                };
              }

              const tools = {
                web_search: tool({
                  description:
                    "Search the live web for current documentation, APIs, news or facts. Returns up to 5 results with title, snippet and URL.",
                  inputSchema: z.object({ query: z.string() }),
                  execute: traced<{ query: string }>(
                    "search",
                    (i) => i.query,
                    async ({ query }) => webSearch(query),
                  ),
                }),
                fetch_page: tool({
                  description:
                    "Fetch a URL and return its readable text. Use it after web_search to read the actual documentation page before writing code.",
                  inputSchema: z.object({ url: z.string() }),
                  execute: traced<{ url: string }>(
                    "read",
                    (i) => i.url,
                    async ({ url: u }) => fetchPage(u),
                  ),
                }),
                list_files: tool({
                  description: "List every file path in the live project.",
                  inputSchema: z.object({}),
                  execute: traced<Record<string, never>>(
                    "ls",
                    () => `${ws.list().length} files`,
                    async () => ({ files: ws.list() }),
                  ),
                }),
                read_file: tool({
                  description: "Read the full current contents of one project file. Always read before editing.",
                  inputSchema: z.object({ path: z.string() }),
                  execute: traced<{ path: string }>(
                    "cat",
                    (i) => i.path,
                    async ({ path }) => ws.read(path),
                  ),
                }),
                write_file: tool({
                  description:
                    "Create a new file or fully replace an existing one. Use full project paths such as src/App.jsx.",
                  inputSchema: z.object({ path: z.string(), content: z.string() }),
                  execute: traced<{ path: string; content: string }>(
                    "write",
                    (i) => i.path,
                    async ({ path, content }) => ws.write(path, content),
                  ),
                }),
                edit_file: tool({
                  description:
                    "Surgically replace an exact snippet inside a file. `find` must appear exactly once, copied verbatim from the current file. Preferred over rewriting whole files.",
                  inputSchema: z.object({ path: z.string(), find: z.string(), replace: z.string() }),
                  execute: traced<{ path: string; find: string; replace: string }>(
                    "edit",
                    (i) => i.path,
                    async ({ path, find, replace }) => ws.edit(path, find, replace),
                  ),
                }),
                delete_file: tool({
                  description: "Delete a file from the project. Only when the user asked for it.",
                  inputSchema: z.object({ path: z.string() }),
                  execute: traced<{ path: string }>(
                    "rm",
                    (i) => i.path,
                    async ({ path }) => ws.remove(path),
                  ),
                }),
                check_project: tool({
                  description:
                    "Static self-test of the whole project: missing entry file, unresolved relative imports, unbalanced braces, placeholders. Run after your edits.",
                  inputSchema: z.object({}),
                  execute: traced<Record<string, never>>(
                    "check",
                    () => "static analysis",
                    async () => ws.check(),
                  ),
                }),
              };

              /**
               * Weaker models sometimes type a tool call into the answer text instead of
               * using the tool channel. Recover those so the file still lands in the
               * project instead of being silently dropped.
               */
              function salvageToolCalls(text: string) {
                const candidates: string[] = [];
                for (const re of [
                  /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g,
                  /```(?:json|tool_call|tool_code)?\s*(\{[\s\S]*?\})\s*```/g,
                ]) {
                  for (const m of text.matchAll(re)) candidates.push(m[1]);
                }
                for (const raw of candidates) {
                  let parsed: Record<string, unknown>;
                  try {
                    parsed = JSON.parse(raw);
                  } catch {
                    continue;
                  }
                  const name = String(parsed.name ?? parsed.tool ?? parsed.function ?? "");
                  const args = (parsed.arguments ?? parsed.parameters ?? parsed.args ?? {}) as Record<
                    string,
                    unknown
                  >;
                  const path = typeof args.path === "string" ? args.path : "";
                  if (!path) continue;
                  let out: Record<string, unknown> | null = null;
                  if (name === "write_file" && typeof args.content === "string")
                    out = ws.write(path, args.content);
                  else if (
                    name === "edit_file" &&
                    typeof args.find === "string" &&
                    typeof args.replace === "string"
                  )
                    out = ws.edit(path, args.find, args.replace);
                  else if (name === "delete_file") out = ws.remove(path);
                  if (!out) continue;
                  marker("salvage", `${name} → ${path}`);
                  result(!("error" in out), typeof out.error === "string" ? out.error : "");
                }
              }

              /** One streaming pass. Returns the finish reason so we can resume. */
              async function pass(
                convo: ModelMessage[],
                mdl: CodexModel & { resolved: LanguageModel },
              ): Promise<{ reason: string; text: string; chars: number }> {
                let reasoningOpen = false;
                let text = "";
                let chars = 0;
                const res = streamText({
                  model: mdl.resolved,
                  system,
                  messages: convo,
                  stopWhen: stepCountIs(mdl.tools ? 50 : 1),
                  // Providers default to their model's full window (32k-64k), which free
                  // tiers refuse outright. Every non-Lovable model pins its own ceiling.
                  ...(mdl.providerKey === "lovable" ? {} : { maxOutputTokens: mdl.maxOutput ?? 4000 }),
                  ...(mdl.thinking && mdl.providerKey === "openrouter"
                    ? { providerOptions: { openrouter: { reasoning: { effort: "medium" } } } }
                    : {}),
                  ...(mdl.tools ? { tools } : {}),
                });

                for await (const part of res.fullStream) {
                  if (part.type === "reasoning-delta") {
                    if (!reasoningOpen) {
                      reasoningOpen = true;
                      push("<thinking>");
                    }
                    chars += part.text.length;
                    push(part.text);
                  } else if (part.type === "text-delta") {
                    if (reasoningOpen) {
                      reasoningOpen = false;
                      push("</thinking>\n\n");
                    }
                    text += part.text;
                    chars += part.text.length;
                    push(part.text);
                  } else if (part.type === "tool-call") {
                    chars += 1;
                  } else if (part.type === "error") {
                    const err = part.error;
                    throw err instanceof Error ? err : new Error(String(err));
                  }
                }
                if (reasoningOpen) push("</thinking>\n\n");
                let reason = "stop";
                try {
                  reason = await res.finishReason;
                } catch {
                  reason = "error";
                }
                return { reason, text, chars };
              }

              try {
                const convo = [...messages];
                let active = chain[0] as CodexModel & { resolved: LanguageModel };
                let reason = "error";
                let text = "";

                // Try the chosen model, then rescue models, but only while nothing has
                // been streamed yet — never restart a half-written answer.
                for (let i = 0; i < chain.length; i++) {
                  const candidate = chain[i] as CodexModel & { resolved: LanguageModel };
                  if (i > 0) {
                    marker("fallback", `${chain[0].name} unavailable → ${candidate.name}`);
                    result(true, candidate.name);
                  }
                  try {
                    const out = await pass(convo, candidate);
                    active = candidate;
                    reason = out.reason;
                    text = out.text;
                    if (out.chars > 0 || out.reason !== "error") break;
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    if (i === chain.length - 1) throw e;
                    console.warn("[/api/chat fallback]", candidate.id, msg.slice(0, 200));
                    continue;
                  }
                }

                // Providers truncate long builds mid-file. Resume from the exact
                // stopping point instead of leaving broken code on screen.
                for (let i = 0; i < 3; i++) {
                  const unclosed = (text.match(/^\s*```/gm) ?? []).length % 2 === 1;
                  if (reason !== "length" && !(unclosed && reason !== "error")) break;
                  marker("resume", "continuing");
                  result(true, "");
                  convo.push({ role: "assistant", content: text } as ModelMessage);
                  convo.push({
                    role: "user",
                    content:
                      "Your previous message was cut off mid-answer. Continue from the EXACT character where you stopped. Do not repeat anything, do not restate the plan, do not reopen a fence you already opened — just continue and finish, including the Self-test and How to verify sections.",
                  } as ModelMessage);
                  const next = await pass(convo, active);
                  reason = next.reason;
                  text = text + next.text;
                }

                salvageToolCalls(full);
              } catch (e) {
                const msg = e instanceof Error ? e.message : "stream error";
                push(`\n\n[error] ${msg}`);
              }

              // Apply tool-driven file changes to the transcript so the preview,
              // editor and file browser pick them up.
              if (ws.changed.size || ws.deleted.size) push(changeBlocks(ws));

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

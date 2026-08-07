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
  rename(from: string, to: string) {
    const f = this.files.get(from);
    if (!f) return { error: `No such file: ${from}` };
    if (this.files.has(to)) return { error: `${to} already exists — pick another path.` };
    this.files.set(to, { code: f.code, lang: langOf(to) });
    this.files.delete(from);
    this.changed.add(to);
    this.changed.delete(from);
    this.deleted.add(from);
    return { ok: true, from, to };
  }

  /** Recorded dependencies. The preview resolves bare imports from a CDN. */
  deps = new Set<string>();
  install(pkg: string, version = "latest") {
    const name = pkg.trim().replace(/\s+/g, "");
    if (!name) return { error: "package name is required" };
    this.deps.add(name);
    const pj = this.files.get("package.json");
    if (pj) {
      try {
        const json = JSON.parse(pj.code) as Record<string, unknown>;
        const deps = (json.dependencies as Record<string, string>) ?? {};
        deps[name] = version === "latest" ? "*" : version;
        json.dependencies = deps;
        this.write("package.json", JSON.stringify(json, null, 2) + "\n");
      } catch {
        /* leave a malformed package.json alone */
      }
    }
    return {
      ok: true,
      installed: name,
      note: "The preview resolves bare imports from esm.sh automatically — just import it.",
    };
  }

  format(path: string) {
    const f = this.files.get(path);
    if (!f) return { error: `No such file: ${path}` };
    const code =
      f.code
        .replace(/\t/g, "  ")
        .split("\n")
        .map((l) => l.replace(/[ \t]+$/, ""))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\s+$/, "") + "\n";
    const changed = code !== f.code;
    if (changed) {
      this.files.set(path, { code, lang: f.lang });
      this.changed.add(path);
    }
    return { ok: true, path, changed };
  }

  /** Deeper review than check(): quality, a11y and leftovers. */
  lint() {
    const warnings: string[] = [];
    for (const [path, f] of this.files) {
      const lines = f.code.split("\n");
      lines.forEach((l, i) => {
        const at = `${path}:${i + 1}`;
        if (/console\.log\(/.test(l)) warnings.push(`${at}: leftover console.log`);
        if (/<img(?![^>]*\balt=)[^>]*>/.test(l)) warnings.push(`${at}: <img> without alt text`);
        if (/<div[^>]*onClick=/.test(l)) warnings.push(`${at}: click handler on a div — use a button`);
        if (/\.map\(\s*\(?[a-zA-Z]/.test(l) && /<[A-Za-z]/.test(l) && !/key=/.test(l))
          warnings.push(`${at}: list item may be missing a React key`);
        if (/(?:width|height|color|background):\s*#?[0-9a-fA-F]{3,6}\b/.test(l) && /style=\{\{/.test(l))
          warnings.push(`${at}: hardcoded inline colour — use a token`);
        if (l.length > 220) warnings.push(`${at}: very long line (${l.length} chars)`);
      });
    }
    const base = this.check();
    return {
      ok: base.ok && warnings.length === 0,
      errors: base.problems,
      warnings: warnings.slice(0, 60),
    };
  }

  /** Structural map so the agent can reason about the project without reading it all. */
  index() {
    const out = [...this.files.entries()].map(([path, f]) => {
      const imports = [...f.code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      const exports = [...f.code.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Za-z0-9_$]+)/g)].map(
        (m) => m[1],
      );
      return {
        path,
        lang: f.lang,
        lines: f.code.split("\n").length,
        bytes: f.code.length,
        hasDefaultExport: /export\s+default/.test(f.code),
        exports: exports.slice(0, 12),
        imports: imports.slice(0, 20),
      };
    });
    return { files: out, entry: out.find((f) => /^src\/App\.(jsx|tsx)$/.test(f.path))?.path ?? null };
  }

  /** Write a README from the real file list. */
  docs(title = "Project") {
    const idx = this.index();
    const body = [
      `# ${title}`,
      "",
      "Generated with OpenMatrix Agent.",
      "",
      "## Files",
      "",
      ...idx.files.map((f) => `- \`${f.path}\` — ${f.lines} lines${f.exports.length ? `, exports ${f.exports.join(", ")}` : ""}`),
      "",
      "## Run locally",
      "",
      "```bash",
      "npm install",
      "npm run dev",
      "```",
      "",
      ...(this.deps.size ? ["## Dependencies", "", ...[...this.deps].map((d) => `- ${d}`), ""] : []),
    ].join("\n");
    this.write("README.md", body);
    return { ok: true, path: "README.md", bytes: body.length };
  }

  /** Static "build": resolve the module graph and report like a bundler would. */
  build() {
    const started = Date.now();
    const problems = this.check();
    const idx = this.index();
    const bytes = [...this.files.values()].reduce((n, f) => n + f.code.length, 0);
    return {
      ok: problems.ok,
      entry: idx.entry,
      modules: idx.files.length,
      bytes,
      ms: Date.now() - started,
      problems: problems.problems,
    };
  }

  /** Sandbox shell over the project — the same commands the Terminal tab exposes. */
  runCommand(command: string): { command: string; output: string; code: number } {
    const cmd = command.trim();
    const [name, ...args] = cmd.split(/\s+/);
    const arg = args.join(" ");
    const done = (output: string, code = 0) => ({ command: cmd, output, code });

    switch (name) {
      case "ls":
        return done(
          this.list()
            .filter((p) => (arg ? p.startsWith(arg.replace(/\/$/, "") + "/") : true))
            .join("\n") || "(empty)",
        );
      case "tree":
        return done(
          [...this.files.entries()].map(([p, f]) => `${p}  ${f.code.split("\n").length}L`).join("\n"),
        );
      case "cat": {
        const f = this.files.get(arg);
        return f ? done(f.code.slice(0, 8000)) : done(`cat: ${arg}: not found`, 1);
      }
      case "wc":
        return done(
          [...this.files.entries()]
            .map(([p, f]) => `${String(f.code.split("\n").length).padStart(5)} ${p}`)
            .join("\n"),
        );
      case "grep": {
        if (!arg) return done("usage: grep <pattern>", 1);
        const hits: string[] = [];
        for (const [p, f] of this.files)
          f.code.split("\n").forEach((l, i) => {
            if (l.toLowerCase().includes(arg.toLowerCase())) hits.push(`${p}:${i + 1}: ${l.trim()}`);
          });
        return done(hits.slice(0, 60).join("\n") || "no matches");
      }
      case "stat":
        return done(`files ${this.files.size}\ndeps  ${[...this.deps].join(", ") || "none"}`);
      case "build": {
        const r = this.build();
        return done(
          `entry ${r.entry ?? "none"}\nmodules ${r.modules}\nbytes ${r.bytes}\n` +
            (r.ok ? "✓ build passed" : r.problems.map((p) => `✗ ${p}`).join("\n")),
          r.ok ? 0 : 1,
        );
      }
      case "test": {
        const r = this.check();
        return done(r.ok ? "✓ all checks passed" : r.problems.map((p) => `✗ ${p}`).join("\n"), r.ok ? 0 : 1);
      }
      case "lint": {
        const r = this.lint();
        return done(
          [...r.errors.map((e) => `error ${e}`), ...r.warnings.map((w) => `warn  ${w}`)].join("\n") ||
            "✓ no lint findings",
          r.errors.length ? 1 : 0,
        );
      }
      case "npm":
      case "pnpm":
      case "bun":
      case "yarn": {
        if (args[0] === "install" || args[0] === "add" || args[0] === "i") {
          const pkgs = args.slice(1).filter((a) => !a.startsWith("-"));
          if (!pkgs.length) return done("up to date, audited 0 packages");
          pkgs.forEach((p) => this.install(p));
          return done(`added ${pkgs.length} package(s): ${pkgs.join(", ")}`);
        }
        if (args[0] === "run" || args[0] === "build") return this.runCommand("build");
        return done(`${name}: unsupported subcommand "${args[0] ?? ""}"`, 1);
      }
      case "echo":
        return done(arg);
      case "":
      case undefined:
        return done("", 0);
      default:
        return done(
          `${name}: command not found. Available: ls, tree, cat, grep, wc, stat, build, test, lint, npm install <pkg>, echo.`,
          127,
        );
    }
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

          let languageModel;
          try {
            languageModel = resolveModel(model);
          } catch (e) {
            return new Response(e instanceof Error ? e.message : "model unavailable", { status: 500 });
          }

          const ws = new Workspace(body.files ?? []);
          const system = body.context ? `${SYSTEM_PROMPT}\n\n${body.context}` : SYSTEM_PROMPT;

          const tools = {
            web_search: tool({
              description:
                "Search the live web for current documentation, APIs, news or facts. Returns up to 5 results with title, snippet and URL.",
              inputSchema: z.object({ query: z.string() }),
              execute: async ({ query }) => webSearch(query),
            }),
            fetch_page: tool({
              description:
                "Fetch a URL and return its readable text. Use it after web_search to read the actual documentation page before writing code.",
              inputSchema: z.object({ url: z.string() }),
              execute: async ({ url: u }) => fetchPage(u),
            }),
            list_files: tool({
              description: "List every file path in the live project.",
              inputSchema: z.object({}),
              execute: async () => ({ files: ws.list() }),
            }),
            read_file: tool({
              description: "Read the full current contents of one project file. Always read before editing.",
              inputSchema: z.object({ path: z.string() }),
              execute: async ({ path }) => ws.read(path),
            }),
            write_file: tool({
              description:
                "Create a new file or fully replace an existing one. Use full project paths such as src/App.jsx.",
              inputSchema: z.object({ path: z.string(), content: z.string() }),
              execute: async ({ path, content }) => ws.write(path, content),
            }),
            edit_file: tool({
              description:
                "Surgically replace an exact snippet inside a file. `find` must appear exactly once, copied verbatim from the current file. Preferred over rewriting whole files.",
              inputSchema: z.object({ path: z.string(), find: z.string(), replace: z.string() }),
              execute: async ({ path, find, replace }) => ws.edit(path, find, replace),
            }),
            delete_file: tool({
              description: "Delete a file from the project. Only when the user asked for it.",
              inputSchema: z.object({ path: z.string() }),
              execute: async ({ path }) => ws.remove(path),
            }),
            rename_file: tool({
              description: "Rename or move a file, keeping its contents. Update every import that referenced it.",
              inputSchema: z.object({ from: z.string(), to: z.string() }),
              execute: async ({ from, to }) => ws.rename(from, to),
            }),
            install_package: tool({
              description:
                "Record an npm dependency for the project. The preview resolves bare imports from a CDN, so after installing you can import the package directly.",
              inputSchema: z.object({ name: z.string(), version: z.string().default("latest") }),
              execute: async ({ name, version }) => ws.install(name, version),
            }),
            run_command: tool({
              description:
                "Run a command in the project sandbox shell. Supported: ls, tree, cat <file>, grep <text>, wc, stat, build, test, lint, npm install <pkg>, echo.",
              inputSchema: z.object({ command: z.string() }),
              execute: async ({ command }) => ws.runCommand(command),
            }),
            lint_project: tool({
              description:
                "Deep quality review: leftover console.log, missing alt text, click handlers on divs, missing React keys, hardcoded colours, plus all build errors.",
              inputSchema: z.object({}),
              execute: async () => ws.lint(),
            }),
            format_file: tool({
              description: "Normalise whitespace and indentation in one file.",
              inputSchema: z.object({ path: z.string() }),
              execute: async ({ path }) => ws.format(path),
            }),
            index_project: tool({
              description:
                "Structural map of the project: every file with its line count, exports and imports, plus the detected entry file. Use this before large refactors instead of reading everything.",
              inputSchema: z.object({}),
              execute: async () => ws.index(),
            }),
            write_docs: tool({
              description: "Generate README.md from the real project structure.",
              inputSchema: z.object({ title: z.string().default("Project") }),
              execute: async ({ title }) => ws.docs(title),
            }),
            build_project: tool({
              description:
                "Build the project: resolve the module graph, report entry file, module count, bundle size and any blocking problems. Run this before you finish.",
              inputSchema: z.object({}),
              execute: async () => ws.build(),
            }),
            check_project: tool({
              description:
                "Static self-test of the whole project: missing entry file, unresolved relative imports, unbalanced braces, placeholders. Run after your edits.",
              inputSchema: z.object({}),
              execute: async () => ws.check(),
            }),
          };


          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              let full = "";
              const push = (s: string) => {
                full += s;
                controller.enqueue(encoder.encode(s));
              };

              /** One streaming pass. Returns the finish reason so we can resume. */
              async function pass(convo: ModelMessage[]): Promise<{ reason: string; text: string }> {
                let reasoningOpen = false;
                let text = "";
                const result = streamText({
                  model: languageModel!,
                  system,
                  messages: convo,
                  stopWhen: stepCountIs(model.tools ? 50 : 1),
                  // Third-party providers default to huge budgets that some accounts cannot
                  // afford, and Groq's free tier rejects large per-request token budgets.
                  ...(model.providerKey === "lovable"
                    ? {}
                    : { maxOutputTokens: model.providerKey === "groq" ? 3500 : 8000 }),
                  ...(model.thinking && model.providerKey === "openrouter"
                    ? { providerOptions: { openrouter: { reasoning: { effort: "medium" } } } }
                    : {}),
                  ...(model.tools ? { tools } : {}),
                });

                for await (const part of result.fullStream) {
                  if (part.type === "reasoning-delta") {
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
                    text += part.text;
                    push(part.text);
                  } else if (part.type === "tool-call") {
                    const input = part.input as Record<string, unknown>;
                    const label = String(
                      input?.query ?? input?.url ?? input?.command ?? input?.path ?? input?.name ?? input?.from ?? "",
                    );
                    const kind = TOOL_MARKER[part.toolName] ?? "check";
                    push(`\n\n[[oc:${kind}:${label.replace(/[\]\n]/g, " ")}]]\n\n`);

                  } else if (part.type === "error") {
                    const err = part.error;
                    push(`\n\n[error] ${err instanceof Error ? err.message : String(err)}`);
                  }
                }
                if (reasoningOpen) push("</thinking>\n\n");
                let reason = "stop";
                try {
                  reason = await result.finishReason;
                } catch {
                  reason = "error";
                }
                return { reason, text };
              }

              try {
                const convo = [...messages];
                let { reason, text } = await pass(convo);
                // Providers truncate long builds mid-file. Resume from the exact
                // stopping point instead of leaving broken code on screen.
                for (let i = 0; i < 3; i++) {
                  const unclosed = (text.match(/^\s*```/gm) ?? []).length % 2 === 1;
                  if (reason !== "length" && !(unclosed && reason !== "error")) break;
                  push(`\n\n[[oc:resume:continuing]]\n\n`);
                  convo.push({ role: "assistant", content: text } as ModelMessage);
                  convo.push({
                    role: "user",
                    content:
                      "Your previous message was cut off mid-answer. Continue from the EXACT character where you stopped. Do not repeat anything, do not restate the plan, do not reopen a fence you already opened — just continue and finish, including the Self-test and How to verify sections.",
                  } as ModelMessage);
                  const next = await pass(convo);
                  reason = next.reason;
                  text = text + next.text;
                }
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

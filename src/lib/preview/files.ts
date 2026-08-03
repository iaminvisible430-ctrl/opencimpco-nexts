export type PFile = {
  path: string;
  lang: string;
  code: string;
};

const EXT_LANG: Record<string, string> = {
  jsx: "jsx",
  tsx: "tsx",
  js: "js",
  mjs: "js",
  ts: "ts",
  css: "css",
  scss: "css",
  html: "html",
  htm: "html",
  json: "json",
  md: "md",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  php: "php",
  c: "c",
  h: "c",
  cpp: "cpp",
  cs: "csharp",
  sql: "sql",
  sh: "bash",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  vue: "vue",
  svelte: "svelte",
  dart: "dart",
};

const ALIAS: Record<string, string> = {
  react: "jsx",
  javascript: "js",
  typescript: "ts",
  typescriptreact: "tsx",
  javascriptreact: "jsx",
  py: "python",
  shell: "bash",
  sh: "bash",
  golang: "go",
  "c++": "cpp",
  "c#": "csharp",
};

const LANG_EXT: Record<string, string> = {
  jsx: "jsx",
  tsx: "tsx",
  js: "js",
  ts: "ts",
  css: "css",
  html: "html",
  json: "json",
  md: "md",
  python: "py",
  ruby: "rb",
  go: "go",
  rust: "rs",
  java: "java",
  kotlin: "kt",
  swift: "swift",
  php: "php",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  sql: "sql",
  bash: "sh",
  yaml: "yml",
  toml: "toml",
  vue: "vue",
  svelte: "svelte",
  dart: "dart",
};

function normalize(p: string) {
  return p
    .replace(/^[`'"*\s]+|[`'"*\s:]+$/g, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .trim();
}

/**
 * Many models emit a bare `App.jsx` or `Card.tsx` instead of the `src/…` path the
 * preview runtime mounts. Repair those so the entry file is always found.
 */
function canonical(path: string, lang: string): string {
  let p = normalize(path);
  if (!p) return p;
  if (!p.includes("/")) {
    const base = p.toLowerCase();
    if (lang === "jsx" || lang === "tsx") p = `src/${p}`;
    else if ((lang === "js" || lang === "ts") && /^(app|main|index)\.(js|ts)$/.test(base)) p = `src/${p}`;
  }
  // Normalise casing of the canonical React entry so `src/app.jsx` still boots.
  p = p.replace(/^src\/app\.(jsx|tsx)$/i, (_m, ext) => `src/App.${ext.toLowerCase()}`);
  return p;
}

function defaultPath(lang: string, index: number) {
  if (lang === "html") return index === 0 ? "index.html" : `page-${index}.html`;
  if (lang === "css") return index === 0 ? "styles.css" : `styles-${index}.css`;
  if (["jsx", "tsx"].includes(lang)) return index === 0 ? "src/App.jsx" : `src/File${index}.jsx`;
  if (lang === "js") return index === 0 ? "script.js" : `script-${index}.js`;
  const ext = LANG_EXT[lang] ?? (lang || "txt");
  return index === 0 ? `main.${ext}` : `file-${index}.${ext}`;
}

const PATH_RE = /(?:^|[\s`("'*])((?:[\w.@-]+\/)*[\w.-]+\.[a-zA-Z0-9]{1,5})(?=[\s`)"'*:,]|$)/;

/** Pull a file path out of a prose line such as `**src/App.jsx**` or `File: src/App.jsx`. */
function pathFromProse(line: string): string {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 160) return "";
  const cleaned = trimmed.replace(/^(#{1,6}\s*|[-*]\s*)/, "").replace(/^(file|path|filename)\s*[:=]\s*/i, "");
  const m = PATH_RE.exec(` ${cleaned} `);
  if (!m) return "";
  const candidate = m[1];
  // Reject sentences that merely mention a file in passing.
  if (cleaned.replace(candidate, "").replace(/[\s`*:=,.\-—()]/g, "").length > 24) return "";
  return candidate;
}

const COMMENT_PATH =
  /^\s*(?:\/\/|#|<!--|\/\*)\s*(?:file\s*[:=]\s*)?((?:[\w.@-]+\/)*[\w.-]+\.[a-zA-Z0-9]{1,5})\s*(?:-->|\*\/)?\s*$/;

type RawBlock = { info: string; code: string; before: string; closed: boolean };

/** Scan fences manually so an unterminated (still streaming) block is still usable. */
function scanFences(text: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  const lines = text.split("\n");
  let i = 0;
  let prose: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    const open = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (!open) {
      prose.push(line);
      i++;
      continue;
    }
    const marker = open[1][0].repeat(3);
    const info = open[2] ?? "";
    const body: string[] = [];
    i++;
    let closed = false;
    while (i < lines.length) {
      if (new RegExp(`^\\s*${marker === "`" ? "`" : "~"}{3,}\\s*$`).test(lines[i])) {
        closed = true;
        i++;
        break;
      }
      body.push(lines[i]);
      i++;
    }
    blocks.push({
      info,
      code: body.join("\n") + (closed ? "\n" : ""),
      before: prose.slice(-3).join("\n"),
      closed,
    });
    prose = [];
  }
  return blocks;
}

/**
 * Parse fenced blocks into a virtual project.
 * Path resolution order (most models get at least one of these right):
 *   1. fence info string — ```jsx src/App.jsx  /  ```tsx file=src/Card.tsx
 *   2. the prose line right before the fence — **src/App.jsx** / File: src/App.jsx
 *   3. a leading path comment inside the code — // src/App.jsx
 *   4. a language-based default (src/App.jsx, index.html, …)
 */
export function parseProjectFiles(text: string): PFile[] {
  const files: PFile[] = [];
  let i = 0;
  for (const block of scanFences(text)) {
    const info = block.info.trim();
    let code = block.code;
    const tokens = info.split(/\s+/).filter(Boolean);
    let lang = (tokens[0] || "").toLowerCase();
    let path = "";
    for (const t of tokens.slice(1)) {
      const cleaned = t.replace(/^(file|path|title)=/, "").replace(/["'`]/g, "");
      if (/\.[a-zA-Z0-9]+$/.test(cleaned)) path = cleaned;
    }
    if (!path && /\.[a-zA-Z0-9]+$/.test(lang)) {
      path = lang;
      lang = "";
    }
    if (!path) path = pathFromProse(block.before.split("\n").filter((l) => l.trim()).pop() ?? "");
    if (!path) {
      const first = code.split("\n", 1)[0] ?? "";
      const m = COMMENT_PATH.exec(first);
      if (m) path = m[1];
    }
    if (path) {
      const ext = path.split(".").pop()!.toLowerCase();
      lang = EXT_LANG[ext] ?? lang ?? ext;
    }
    lang = ALIAS[lang] ?? lang;
    // Skip non-file blocks (shell snippets, plain prose fences) with no real code.
    if (!path && !lang && !code.trim()) continue;
    if (!path) path = defaultPath(lang, i);
    const normalized = canonical(path, lang);
    if (!/\.[a-zA-Z0-9]+$/.test(normalized)) continue;
    if (!code.endsWith("\n")) code += "\n";
    const existing = files.findIndex((f) => f.path === normalized);
    const file = { path: normalized, lang, code };
    // A later block for the same path is a revision — keep the newest.
    if (existing >= 0) files[existing] = file;
    else files.push(file);
    i++;
  }
  return files;
}

/** Paths the agent explicitly deleted, encoded as `[[oc:rm:path]]`. */
export function parseFileDeletions(text: string): string[] {
  const out: string[] = [];
  const re = /\[\[oc:rm:([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(normalize(m[1]));
  return out;
}

const RUNNABLE = new Set(["jsx", "tsx", "js", "ts", "css", "html"]);

export function runnableFiles(files: PFile[]): PFile[] {
  return files.filter((f) => RUNNABLE.has(f.lang));
}

export type ProjectKind = "react" | "html" | null;

export function projectKind(files: PFile[]): ProjectKind {
  const runnable = runnableFiles(files);
  if (runnable.some((f) => f.lang === "jsx" || f.lang === "tsx")) return "react";
  if (runnable.some((f) => /(^|\n)\s*(import|export)\s/.test(f.code) && f.lang === "js")) return "react";
  if (runnable.some((f) => f.lang === "html" || f.lang === "css" || f.lang === "js")) return "html";
  return null;
}

/** True when the project has files worth showing in the file browser. */
export function hasFiles(files: PFile[]): boolean {
  return files.length > 0;
}

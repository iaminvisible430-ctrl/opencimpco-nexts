export type PFile = {
  path: string;
  lang: string;
  code: string;
};

const FENCE = /```([^\n`]*)\n([\s\S]*?)```/g;

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
  return p.replace(/^\.\//, "").replace(/^\/+/, "").trim();
}

function defaultPath(lang: string, index: number) {
  if (lang === "html") return index === 0 ? "index.html" : `page-${index}.html`;
  if (lang === "css") return index === 0 ? "styles.css" : `styles-${index}.css`;
  if (["jsx", "tsx"].includes(lang)) return index === 0 ? "src/App.jsx" : `src/File${index}.jsx`;
  if (lang === "js") return index === 0 ? "script.js" : `script-${index}.js`;
  const ext = LANG_EXT[lang] ?? (lang || "txt");
  return index === 0 ? `main.${ext}` : `file-${index}.${ext}`;
}

/**
 * Parse fenced blocks into a virtual project.
 * Supported info strings:
 *   ```jsx src/App.jsx
 *   ```tsx file=src/Card.tsx
 *   ```python app/main.py
 *   ```css
 */
export function parseProjectFiles(text: string): PFile[] {
  const files: PFile[] = [];
  const re = new RegExp(FENCE);
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    const info = (m[1] || "").trim();
    const code = m[2];
    const tokens = info.split(/\s+/).filter(Boolean);
    let lang = (tokens[0] || "").toLowerCase();
    let path = "";
    for (const t of tokens.slice(1)) {
      const cleaned = t.replace(/^file=/, "").replace(/^title=/, "").replace(/["']/g, "");
      if (/\.[a-zA-Z0-9]+$/.test(cleaned)) path = cleaned;
    }
    if (!path && /\.[a-zA-Z0-9]+$/.test(lang)) {
      path = lang;
      lang = "";
    }
    if (path) {
      const ext = path.split(".").pop()!.toLowerCase();
      lang = EXT_LANG[ext] ?? lang ?? ext;
    }
    lang = ALIAS[lang] ?? lang;
    if (!path) path = defaultPath(lang, i);
    const normalized = normalize(path);
    const existing = files.findIndex((f) => f.path === normalized);
    const file = { path: normalized, lang, code };
    // A later block for the same path is a revision — keep the newest.
    if (existing >= 0) files[existing] = file;
    else files.push(file);
    i++;
  }
  return files;
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

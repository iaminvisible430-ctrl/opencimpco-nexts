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
  ts: "ts",
  css: "css",
  html: "html",
  json: "json",
};

function normalize(p: string) {
  return p.replace(/^\.\//, "").replace(/^\/+/, "").trim();
}

function defaultPath(lang: string, index: number) {
  if (lang === "html") return index === 0 ? "index.html" : `page-${index}.html`;
  if (lang === "css") return index === 0 ? "styles.css" : `styles-${index}.css`;
  if (["jsx", "tsx", "react"].includes(lang)) return index === 0 ? "src/App.jsx" : `src/File${index}.jsx`;
  if (["js", "javascript"].includes(lang)) return index === 0 ? "script.js" : `script-${index}.js`;
  return `file-${index}.${lang || "txt"}`;
}

/**
 * Parse fenced blocks into a virtual project.
 * Supported info strings:
 *   ```jsx src/App.jsx
 *   ```tsx file=src/Card.tsx
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
    if (lang === "react") lang = "jsx";
    if (lang === "javascript") lang = "js";
    if (lang === "typescript") lang = "ts";
    if (!path) path = defaultPath(lang, i);
    files.push({ path: normalize(path), lang, code });
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

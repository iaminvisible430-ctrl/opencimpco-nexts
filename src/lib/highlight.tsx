import { Fragment, type ReactNode } from "react";

/**
 * Dependency-free syntax highlighter.
 * Tokenises with one ordered regex per language family so it stays fast enough
 * to re-run on every streaming chunk.
 */

type Family = "web" | "markup" | "style" | "shell" | "data" | "generic";

const FAMILY: Record<string, Family> = {
  js: "web",
  jsx: "web",
  ts: "web",
  tsx: "web",
  json: "data",
  html: "markup",
  vue: "markup",
  svelte: "markup",
  css: "style",
  scss: "style",
  bash: "shell",
  sh: "shell",
  python: "web",
  ruby: "web",
  go: "web",
  rust: "web",
  java: "web",
  kotlin: "web",
  swift: "web",
  php: "web",
  c: "web",
  cpp: "web",
  csharp: "web",
  sql: "web",
  yaml: "data",
  toml: "data",
  dart: "web",
};

const KEYWORDS =
  /\b(?:abstract|as|async|await|break|case|catch|class|const|constructor|continue|declare|def|default|delete|do|elif|else|enum|export|extends|false|final|finally|fn|for|from|func|function|get|global|if|impl|implements|import|in|instanceof|interface|is|lambda|let|match|mut|new|nil|none|not|null|or|and|package|pass|private|protected|public|pub|raise|readonly|return|self|set|static|struct|super|switch|then|this|throw|throws|trait|true|try|type|typeof|undefined|use|var|void|when|where|while|with|yield|select|insert|update|delete|where|join|group|order|by|limit)\b/;

const PATTERNS: Record<Family, { cls: string; re: RegExp }[]> = {
  web: [
    { cls: "tok-com", re: /\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|--[^\n]*/ },
    { cls: "tok-str", re: /`(?:\\[\s\S]|[^`\\])*`?|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/ },
    { cls: "tok-tag", re: /<\/?[A-Z][\w.]*|<\/?[a-z][\w-]*(?=[\s/>])/ },
    { cls: "tok-num", re: /\b0x[\da-fA-F]+\b|\b\d[\d_.]*(?:e[+-]?\d+)?\b/ },
    { cls: "tok-kw", re: KEYWORDS },
    { cls: "tok-fn", re: /\b[A-Za-z_$][\w$]*(?=\s*\()/ },
    { cls: "tok-type", re: /\b[A-Z][\w$]*\b/ },
    { cls: "tok-punc", re: /[{}()[\];,.:?!<>+\-*/%=&|^~]+/ },
  ],
  markup: [
    { cls: "tok-com", re: /<!--[\s\S]*?-->/ },
    { cls: "tok-str", re: /"(?:[^"\n])*"?|'(?:[^'\n])*'?/ },
    { cls: "tok-tag", re: /<\/?[A-Za-z][\w:-]*|\/?>/ },
    { cls: "tok-attr", re: /\b[a-zA-Z-]+(?==)/ },
    { cls: "tok-num", re: /&[a-z]+;/ },
  ],
  style: [
    { cls: "tok-com", re: /\/\*[\s\S]*?\*\// },
    { cls: "tok-str", re: /"(?:[^"\n])*"?|'(?:[^'\n])*'?/ },
    { cls: "tok-kw", re: /@[a-z-]+/ },
    { cls: "tok-type", re: /[.#][\w-]+|&:[\w-]+|::?[a-z-]+(?=[\s,{])/ },
    { cls: "tok-attr", re: /\b[a-z-]+(?=\s*:)/ },
    { cls: "tok-num", re: /-?\b[\d.]+(?:px|rem|em|%|s|ms|vh|vw|dvh|fr|deg)?\b|#[\da-fA-F]{3,8}/ },
    { cls: "tok-punc", re: /[{}();,]+/ },
  ],
  shell: [
    { cls: "tok-com", re: /#[^\n]*/ },
    { cls: "tok-str", re: /"(?:\\.|[^"\\])*"?|'(?:[^'])*'?/ },
    { cls: "tok-kw", re: /\b(?:if|then|fi|for|do|done|while|case|esac|export|cd|echo|sudo|npm|bun|npx|pnpm|yarn|git|node|python3?|pip|make|docker)\b/ },
    { cls: "tok-attr", re: /(?:^|\s)-{1,2}[\w-]+/ },
    { cls: "tok-num", re: /\$\w+|\$\{[^}]*\}/ },
  ],
  data: [
    { cls: "tok-com", re: /#[^\n]*/ },
    { cls: "tok-attr", re: /"(?:\\.|[^"\\])*"(?=\s*:)|^\s*[\w.-]+(?=\s*:)/m },
    { cls: "tok-str", re: /"(?:\\.|[^"\\])*"?/ },
    { cls: "tok-kw", re: /\b(?:true|false|null)\b/ },
    { cls: "tok-num", re: /-?\b[\d.]+\b/ },
    { cls: "tok-punc", re: /[{}[\],:]+/ },
  ],
  generic: [
    { cls: "tok-com", re: /#[^\n]*|\/\/[^\n]*/ },
    { cls: "tok-str", re: /"(?:[^"\n])*"?|'(?:[^'\n])*'?/ },
    { cls: "tok-num", re: /\b[\d.]+\b/ },
  ],
};

const CACHE = new Map<Family, RegExp>();

function scanner(family: Family) {
  const cached = CACHE.get(family);
  if (cached) return cached;
  const re = new RegExp(
    PATTERNS[family].map((p) => `(${p.re.source})`).join("|"),
    PATTERNS[family].some((p) => p.re.flags.includes("m")) ? "gm" : "g",
  );
  CACHE.set(family, re);
  return re;
}

export function highlight(code: string, lang: string): ReactNode {
  const family = FAMILY[(lang || "").toLowerCase()] ?? "generic";
  const defs = PATTERNS[family];
  const re = new RegExp(scanner(family));
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = re.exec(code))) {
    if (m[0] === "") {
      re.lastIndex++;
      continue;
    }
    if (m.index > last) out.push(<Fragment key={key++}>{code.slice(last, m.index)}</Fragment>);
    const groupIndex = m.slice(1).findIndex((g) => g !== undefined);
    const cls = defs[groupIndex]?.cls ?? "";
    out.push(
      <span key={key++} className={cls}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(<Fragment key={key++}>{code.slice(last)}</Fragment>);
  return out;
}

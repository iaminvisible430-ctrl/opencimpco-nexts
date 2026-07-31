import type { PFile } from "./build";

export type Issue = {
  level: "error" | "warn";
  file: string;
  message: string;
};

const IMPORT_RE = /(?:^|\n)\s*import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
const EXTS = ["", ".jsx", ".tsx", ".js", ".ts", ".css", "/index.jsx", "/index.tsx", "/index.js"];

function resolveLocal(from: string, spec: string, files: PFile[]): boolean {
  const baseDir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const joined = spec.startsWith("./") || spec.startsWith("../") ? `${baseDir}/${spec}` : spec;
  const parts: string[] = [];
  for (const seg of joined.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  const target = parts.join("/");
  return files.some((f) => EXTS.some((e) => f.path === target + e));
}

function balanced(code: string): boolean {
  let depth = 0;
  for (const c of code) {
    if (c === "{") depth++;
    else if (c === "}") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/** Static checks that mirror the model's self-test contract. */
export function analyzeProject(files: PFile[]): Issue[] {
  const issues: Issue[] = [];
  const code = files.filter((f) => ["jsx", "tsx", "js", "ts"].includes(f.lang));

  for (const f of files) {
    if (!f.code.trim()) issues.push({ level: "warn", file: f.path, message: "File is empty" });
    if (/\bTODO\b|\.\.\.rest of|your code here/i.test(f.code))
      issues.push({ level: "warn", file: f.path, message: "Contains a placeholder / TODO" });
    if (["jsx", "tsx", "js", "ts", "css"].includes(f.lang) && !balanced(f.code))
      issues.push({ level: "error", file: f.path, message: "Unbalanced { } braces" });
  }

  for (const f of code) {
    const re = new RegExp(IMPORT_RE);
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.code))) {
      const spec = m[1];
      if (!spec.startsWith(".") && !spec.startsWith("/")) continue;
      if (!resolveLocal(f.path, spec, files))
        issues.push({ level: "error", file: f.path, message: `Unresolved import "${spec}"` });
    }
  }

  const entry = files.find((f) => /^src\/App\.(jsx|tsx)$/.test(f.path));
  if (code.length && !entry)
    issues.push({ level: "error", file: "src/App.jsx", message: "Missing React entry file src/App.jsx" });
  if (entry && !/export\s+default/.test(entry.code))
    issues.push({ level: "error", file: entry.path, message: "Entry file has no `export default`" });

  return issues;
}

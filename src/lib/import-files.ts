import { unzipSync } from "fflate";
import { toast } from "sonner";

export type ImportedFile = { path: string; code: string; lang: string };

const TEXT_EXT: Record<string, string> = {
  js: "js",
  mjs: "js",
  cjs: "js",
  jsx: "jsx",
  ts: "ts",
  tsx: "tsx",
  css: "css",
  scss: "css",
  html: "html",
  htm: "html",
  json: "json",
  md: "md",
  txt: "text",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  rb: "ruby",
  php: "php",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  env: "text",
  svg: "html",
  vue: "html",
};

const SKIP = /(^|\/)(node_modules|\.git|dist|build|\.next|coverage|\.cache)\//;
const MAX_FILES = 60;
const MAX_BYTES = 60_000;

export function langOf(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXT[ext] ?? null;
}

function clean(path: string) {
  return path.replace(/^\.\//, "").replace(/^\/+/, "");
}

/** Extract every readable source file from a .zip archive in the browser. */
export function extractZip(buf: ArrayBuffer): ImportedFile[] {
  const files = unzipSync(new Uint8Array(buf));
  const out: ImportedFile[] = [];
  const dec = new TextDecoder();
  for (const [rawPath, bytes] of Object.entries(files)) {
    if (out.length >= MAX_FILES) break;
    const path = clean(rawPath);
    if (!path || path.endsWith("/") || SKIP.test(path)) continue;
    const lang = langOf(path);
    if (!lang || bytes.byteLength > MAX_BYTES) continue;
    out.push({ path, lang, code: dec.decode(bytes) });
  }
  return out;
}

/**
 * Turn a user's file picker selection into images (data URLs) plus source files.
 * Supports .zip archives, any text/source file, and images side by side.
 */
export async function importFiles(
  list: FileList | null,
): Promise<{ images: string[]; files: ImportedFile[] }> {
  const images: string[] = [];
  const files: ImportedFile[] = [];
  if (!list) return { images, files };

  for (const f of Array.from(list).slice(0, 12)) {
    try {
      if (f.type.startsWith("image/")) {
        if (f.size > 4 * 1024 * 1024) {
          toast.error(`${f.name} is too large (max 4MB)`);
          continue;
        }
        images.push(
          await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = () => rej(r.error);
            r.readAsDataURL(f);
          }),
        );
        continue;
      }
      if (/\.zip$/i.test(f.name)) {
        const extracted = extractZip(await f.arrayBuffer());
        if (!extracted.length) toast.error(`No readable source files in ${f.name}`);
        files.push(...extracted);
        continue;
      }
      const lang = langOf(f.name);
      if (!lang) {
        toast.error(`${f.name}: unsupported file type`);
        continue;
      }
      if (f.size > MAX_BYTES * 4) {
        toast.error(`${f.name} is too large`);
        continue;
      }
      files.push({ path: clean(f.name), lang, code: await f.text() });
    } catch (e) {
      toast.error(`${f.name}: ${e instanceof Error ? e.message : "could not read file"}`);
    }
  }
  return { images: images.slice(0, 4), files: files.slice(0, MAX_FILES) };
}

/** Render imported files as fenced blocks so they enter the project + model context. */
export function filesToBlocks(files: ImportedFile[]): string {
  if (!files.length) return "";
  return (
    `\n\nI attached ${files.length} file${files.length > 1 ? "s" : ""} — treat them as the current project:\n\n` +
    files.map((f) => `\`\`\`${f.lang} ${f.path}\n${f.code}\n\`\`\``).join("\n\n")
  );
}

import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { CODEX_MODELS } from "@/lib/models";
import { resolveModel } from "@/lib/ai-gateway.server";

const files = new Map<string, string>();
const tools = {
  write_file: tool({
    description: "Create or replace a project file",
    inputSchema: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path, content }: { path: string; content: string }) => {
      files.set(path, content);
      return { ok: true, path, bytes: content.length };
    },
  }),
  check_project: tool({
    description: "Static self-test",
    inputSchema: z.object({}),
    execute: async () => ({ ok: true, problems: [] }),
  }),
};

for (const m of CODEX_MODELS) {
  let lm;
  try {
    lm = resolveModel(m);
  } catch (e: any) {
    console.log(`${m.id.padEnd(20)} SKIP ${e.message}`);
    continue;
  }
  files.clear();
  let text = "";
  let reasoning = 0;
  let toolCalls: string[] = [];
  let err = "";
  try {
    const res = streamText({
      model: lm,
      system:
        "You are a coding agent. Use the write_file tool to create files, then call check_project. Keep prose to one sentence.",
      messages: [
        { role: "user", content: "Create src/App.jsx: a React counter with a button. Then self-check." },
      ],
      stopWhen: stepCountIs(m.tools ? 8 : 1),
      ...(m.providerKey === "lovable" ? {} : { maxOutputTokens: m.maxOutput ?? 4000 }),
      ...(m.tools ? { tools } : {}),
    });
    for await (const p of res.fullStream) {
      if (p.type === "text-delta") text += p.text;
      else if (p.type === "reasoning-delta") reasoning += p.text.length;
      else if (p.type === "tool-call") toolCalls.push(p.toolName);
      else if (p.type === "error") {
        err = String((p.error as any)?.message ?? p.error).slice(0, 140);
      }
    }
  } catch (e: any) {
    err = String(e?.message ?? e).slice(0, 140);
  }
  console.log(
    `${m.id.padEnd(20)} ${m.providerKey.padEnd(11)} text=${String(text.length).padEnd(5)} reason=${String(reasoning).padEnd(5)} tools=[${toolCalls.join(",")}] files=[${[...files.keys()].join(",")}] ${err ? "ERR " + err.replace(/\s+/g, " ") : ""}`,
  );
}

import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

const Input = z.object({
  prompt: z.string().min(1).max(8000),
  /** Optional list of file paths already in the project, for grounded rewrites. */
  files: z.array(z.string()).max(200).optional(),
});

const ENHANCER = `You are a prompt engineer for an elite AI coding agent.
Rewrite the user's rough request into a precise, ambitious build brief the agent can execute in one pass.

Rules:
- Keep the user's actual intent. Never invent a different product.
- Output ONLY the rewritten prompt. No preamble, no headings like "Enhanced prompt", no code fences.
- 90-200 words. Use short lines / dashes, not paragraphs.
- Specify: the concrete screens or files, the data shape, the key interactions, the visual direction (one committed aesthetic, palette, type pairing), the states to cover (loading/empty/error/success), and responsive + a11y expectations.
- If the request is a bug report, restate the symptom, the likely cause, and the expected behaviour.
- If project files are listed, name the files that should change instead of asking for a rewrite.`;

/** Rewrites a rough user prompt into a precise build brief. */
export const enhancePrompt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Prompt enhancer is unavailable (missing gateway key).");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const context = data.files?.length
      ? `\n\nCurrent project files:\n${data.files.slice(0, 120).join("\n")}`
      : "";

    const { text } = await generateText({
      model: gateway("google/gemini-3.6-flash"),
      system: ENHANCER,
      prompt: `${data.prompt}${context}`,
      maxOutputTokens: 700,
    });

    const out = text.trim().replace(/^```[\s\S]*?\n|```$/g, "").trim();
    return { prompt: out || data.prompt };
  });

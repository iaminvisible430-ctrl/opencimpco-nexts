import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { z } from "zod";

const Body = z.object({
  prompt: z.string().min(1).max(8000),
  system: z.string().max(4000).optional(),
  json: z.boolean().optional(),
});

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

/**
 * Built-in AI for generated apps. Preview and shipped projects call this through
 * the injected `ocAI()` helper, so users never need their own API key.
 */
export const Route = createFileRoute("/api/public/ai")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        try {
          const body = Body.parse(await request.json());
          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return Response.json({ error: "AI is not configured" }, { status: 503, headers: cors });
          }
          const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
          const model = createLovableAiGatewayProvider(key)("google/gemini-3.6-flash");
          const { text } = await generateText({
            model,
            maxOutputTokens: 2000,
            system:
              (body.system ?? "You are a concise, helpful assistant embedded in a small web app.") +
              (body.json ? " Reply with valid JSON only, no prose and no code fences." : ""),
            prompt: body.prompt,
          });
          return Response.json({ text }, { headers: cors });
        } catch (e) {
          const message = e instanceof Error ? e.message : "AI request failed";
          return Response.json({ error: message }, { status: 500, headers: cors });
        }
      },
    },
  },
});

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { CodexModel, ProviderKey } from "@/lib/models";

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

const OPENAI_COMPATIBLE: Record<
  Exclude<ProviderKey, "lovable">,
  { baseURL: string; envKey: string; label: string; extraHeaders?: Record<string, string> }
> = {
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    label: "OpenRouter",
    extraHeaders: { "X-Title": "Opencimpco Code" },
  },
  groq: { baseURL: "https://api.groq.com/openai/v1", envKey: "GROQ_API_KEY", label: "Groq" },
  cerebras: { baseURL: "https://api.cerebras.ai/v1", envKey: "CEREBRAS_API_KEY", label: "Cerebras" },
  mistral: { baseURL: "https://api.mistral.ai/v1", envKey: "MISTRAL_API_KEY", label: "Mistral" },
  google: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    envKey: "GEMINI_API_KEY",
    label: "Google Gemini",
  },
  cohere: {
    baseURL: "https://api.cohere.ai/compatibility/v1",
    envKey: "COHERE_API_KEY",
    label: "Cohere",
  },
};

/**
 * Resolve a language model for any of the supported providers.
 * Throws a readable error when the provider's key is missing.
 */
export function resolveModel(model: CodexModel): LanguageModel {
  if (model.providerKey === "lovable") {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    return createLovableAiGatewayProvider(key)(model.provider);
  }

  const cfg = OPENAI_COMPATIBLE[model.providerKey];
  const key = process.env[cfg.envKey];
  if (!key) throw new Error(`Missing ${cfg.envKey} — ${cfg.label} is not configured.`);

  return createOpenAICompatible({
    name: model.providerKey,
    baseURL: cfg.baseURL,
    headers: { Authorization: `Bearer ${key}`, ...(cfg.extraHeaders ?? {}) },
  })(model.provider);
}

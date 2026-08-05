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
  Exclude<ProviderKey, "lovable" | "cloudflare">,
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
  qwen: {
    baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    envKey: "QWEN_CLOUD_API",
    label: "Qwen Cloud",
  },
  huggingface: {
    baseURL: "https://router.huggingface.co/v1",
    envKey: "HUGGINGFACE_API_KEY",
    label: "Hugging Face",
  },
  bazaarlink: {
    baseURL: "https://api.bazaarlink.ai/v1",
    envKey: "BAZARLINK_API_KEY",
    label: "Bazaarlink",
  },
};

/** Cloudflare Workers AI is account-scoped, so its base URL is built at call time. */
function cloudflareProvider() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) {
    throw new Error("Missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID — Cloudflare AI is not configured.");
  }
  return createOpenAICompatible({
    name: "cloudflare",
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1`,
    headers: { Authorization: `Bearer ${token}` },
  });
}

function compat(providerKey: Exclude<ProviderKey, "lovable" | "cloudflare">, model: string) {
  const cfg = OPENAI_COMPATIBLE[providerKey];
  const key = process.env[cfg.envKey];
  if (!key) throw new Error(`Missing ${cfg.envKey} — ${cfg.label} is not configured.`);
  return createOpenAICompatible({
    name: providerKey,
    baseURL: cfg.baseURL,
    headers: { Authorization: `Bearer ${key}`, ...(cfg.extraHeaders ?? {}) },
  })(model);
}

/**
 * A vision-capable model used to OCR/describe attachments for text-only models.
 * Cloudflare's Llama 4 Scout leads the pipeline: it is fast, cheap and available
 * on our account, so every text-only model in the catalog still "sees"
 * screenshots and mockups.
 */
export function resolveOcrModel(): LanguageModel | null {
  const candidates: Array<() => LanguageModel> = [
    () => cloudflareProvider()("@cf/meta/llama-4-scout-17b-16e-instruct"),
    () => {
      const lovableKey = process.env.LOVABLE_API_KEY;
      if (!lovableKey) throw new Error("no lovable key");
      return createLovableAiGatewayProvider(lovableKey)("google/gemini-3.6-flash");
    },
    () => compat("mistral", "mistral-medium-latest"),
    () => compat("google", "gemini-2.5-flash"),
  ];
  for (const make of candidates) {
    try {
      return make();
    } catch {
      // try the next provider in the pipeline
    }
  }
  return null;
}

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
  if (model.providerKey === "cloudflare") {
    return cloudflareProvider()(model.provider);
  }
  return compat(model.providerKey, model.provider);
}

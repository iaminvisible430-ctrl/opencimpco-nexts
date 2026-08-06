export type ProviderKey =
  | "lovable"
  | "openrouter"
  | "groq"
  | "cerebras"
  | "mistral"
  | "google"
  | "cohere"
  | "qwen"
  | "huggingface"
  | "bazaarlink"
  | "cloudflare";

/** Model ids are stored as plain text in the DB, so keep this a string union-ish alias. */
export type CodexModelId = string;

export interface CodexModel {
  id: CodexModelId;
  name: string;
  tagline: string;
  tags: string[];
  cost: number;
  /** Which upstream API serves this model. */
  providerKey: ProviderKey;
  /** The upstream model identifier. */
  provider: string;
  thinking: boolean;
  /** Whether the upstream model reliably supports function/tool calling. */
  tools: boolean;
  /** Native image understanding. Non-vision models get OCR pre-processing instead. */
  vision: boolean;
  /** Grouping label used by the model picker. */
  group: "Flagship" | "Free" | "Fast" | "Coding" | "Open source";
  /** Rough speed hint used for the icon in the model picker. */
  speed: "fast" | "balanced" | "deep";
}

/**
 * Curated catalog: Lovable AI (managed, no key), Qwen Cloud, Mistral, plus the
 * strongest open-source coding models from OpenRouter, Groq and Cloudflare.
 * Every entry has been called live — dead ids are removed rather than hidden.
 */
export const CODEX_MODELS: CodexModel[] = [
  // ---------- Flagship ----------
  {
    id: "om-code-max",
    name: "OpenMatrix Max",
    tagline: "Lovable AI flagship — best multi-file engineering",
    tags: ["Best coding", "Multi-file", "Architecture"],
    cost: 400,
    providerKey: "lovable",
    provider: "google/gemini-3.1-pro-preview",
    thinking: true,
    tools: true,
    vision: true,
    group: "Flagship",
    speed: "deep",
  },
  {
    id: "om-gpt",
    name: "OpenMatrix GPT",
    tagline: "GPT-5.4 via Lovable AI for tricky logic",
    tags: ["Reasoning", "Debugging", "Refactors"],
    cost: 350,
    providerKey: "lovable",
    provider: "openai/gpt-5.4",
    thinking: true,
    tools: true,
    vision: true,
    group: "Flagship",
    speed: "deep",
  },
  {
    id: "om-gpt-terra",
    name: "OpenMatrix GPT Terra",
    tagline: "GPT-5.6 Terra — hardest agentic and architecture work",
    tags: ["Frontier", "Agentic", "Long tasks"],
    cost: 450,
    providerKey: "lovable",
    provider: "openai/gpt-5.6-terra",
    thinking: true,
    tools: true,
    vision: true,
    group: "Flagship",
    speed: "deep",
  },
  {
    id: "nemotron-ultra-550b",
    name: "Nemotron Ultra 550B",
    tagline: "NVIDIA's largest open reasoning model, via OpenRouter",
    tags: ["550B", "Frontier", "Architecture"],
    cost: 200,
    providerKey: "openrouter",
    provider: "nvidia/nemotron-3-ultra-550b-a55b",
    thinking: true,
    tools: true,
    vision: false,
    group: "Flagship",
    speed: "deep",
  },

  // ---------- Fast ----------
  {
    id: "om-code",
    name: "OpenMatrix Code",
    tagline: "Lovable AI default — fast, strong full-stack coding",
    tags: ["Balanced", "React", "Streaming"],
    cost: 120,
    providerKey: "lovable",
    provider: "google/gemini-3.6-flash",
    thinking: true,
    tools: true,
    vision: true,
    group: "Fast",
    speed: "fast",
  },
  {
    id: "om-code-lite",
    name: "OpenMatrix Lite",
    tagline: "Gemini 3.5 Flash — cheap everyday iterations",
    tags: ["Cheap", "Quick fixes", "High volume"],
    cost: 60,
    providerKey: "lovable",
    provider: "google/gemini-3.5-flash",
    thinking: true,
    tools: true,
    vision: true,
    group: "Fast",
    speed: "fast",
  },
  {
    id: "groq-oss120b",
    name: "GPT-OSS 120B (Groq)",
    tagline: "OpenAI's open-weight 120B at Groq speed",
    tags: ["Fast", "Tools", "Everyday code"],
    cost: 80,
    providerKey: "groq",
    provider: "openai/gpt-oss-120b",
    thinking: true,
    tools: true,
    vision: false,
    group: "Fast",
    speed: "fast",
  },
  {
    id: "groq-compound",
    name: "Groq Compound",
    tagline: "Agentic Groq system with built-in web search + code exec",
    tags: ["Agentic", "Web search", "Tools"],
    cost: 100,
    providerKey: "groq",
    provider: "groq/compound",
    thinking: true,
    tools: true,
    vision: false,
    group: "Fast",
    speed: "fast",
  },
  {
    id: "qwen36-groq",
    name: "Qwen 3.6 27B (Groq)",
    tagline: "Groq-hosted Qwen 3.6 — instant everyday coding",
    tags: ["Fastest", "Quick fixes", "Tools"],
    cost: 70,
    providerKey: "groq",
    provider: "qwen/qwen3.6-27b",
    thinking: true,
    tools: true,
    vision: false,
    group: "Fast",
    speed: "fast",
  },

  // ---------- Coding ----------
  {
    id: "qwen3-coder-plus",
    name: "Qwen3 Coder Plus",
    tagline: "Alibaba's flagship coder on Qwen Cloud",
    tags: ["Whole repos", "Agentic", "Refactors"],
    cost: 140,
    providerKey: "qwen",
    provider: "qwen3-coder-plus",
    thinking: true,
    tools: true,
    vision: false,
    group: "Coding",
    speed: "balanced",
  },
  {
    id: "qwen3-max",
    name: "Qwen3 Max",
    tagline: "Qwen's largest reasoning model",
    tags: ["Reasoning", "Architecture", "Long context"],
    cost: 160,
    providerKey: "qwen",
    provider: "qwen3-max",
    thinking: true,
    tools: true,
    vision: false,
    group: "Coding",
    speed: "deep",
  },
  {
    id: "qwen-vl-max",
    name: "Qwen VL Max",
    tagline: "Qwen vision model — screenshots to code",
    tags: ["Vision", "OCR", "Screenshot → UI"],
    cost: 140,
    providerKey: "qwen",
    provider: "qwen-vl-max",
    thinking: true,
    tools: true,
    vision: true,
    group: "Coding",
    speed: "balanced",
  },
  {
    id: "qwen3-coder",
    name: "Qwen3 Coder (OpenRouter)",
    tagline: "Open-weight Qwen3 Coder, great at whole files",
    tags: ["Code", "Node & Python", "APIs"],
    cost: 100,
    providerKey: "openrouter",
    provider: "qwen/qwen3-coder",
    thinking: true,
    tools: true,
    vision: false,
    group: "Coding",
    speed: "balanced",
  },
  {
    id: "codestral",
    name: "Codestral",
    tagline: "Mistral's dedicated coding model",
    tags: ["Code", "Completion", "Refactors"],
    cost: 100,
    providerKey: "mistral",
    provider: "codestral-latest",
    thinking: true,
    tools: true,
    vision: false,
    group: "Coding",
    speed: "fast",
  },
  {
    id: "mistral-medium",
    name: "Mistral Medium 3",
    tagline: "Balanced Mistral model with vision",
    tags: ["Vision", "Balanced", "Docs"],
    cost: 110,
    providerKey: "mistral",
    provider: "mistral-medium-latest",
    thinking: true,
    tools: true,
    vision: true,
    group: "Coding",
    speed: "balanced",
  },

  // ---------- Open source ----------
  {
    id: "deepseek-v3",
    name: "DeepSeek V3.1",
    tagline: "Strong open reasoning model at low cost",
    tags: ["Reasoning", "Cheap", "Code"],
    cost: 90,
    providerKey: "openrouter",
    provider: "deepseek/deepseek-chat-v3.1",
    thinking: true,
    tools: true,
    vision: false,
    group: "Open source",
    speed: "balanced",
  },
  {
    id: "glm-4-6",
    name: "GLM 4.6",
    tagline: "Zhipu's coding-focused open model",
    tags: ["Code", "Agentic", "Long context"],
    cost: 100,
    providerKey: "openrouter",
    provider: "z-ai/glm-4.6",
    thinking: true,
    tools: true,
    vision: false,
    group: "Open source",
    speed: "balanced",
  },
  {
    id: "nemotron-nano-30b",
    name: "Nemotron 3 Nano 30B",
    tagline: "NVIDIA Nemotron 3 Nano — quick reasoning at near-zero cost",
    tags: ["Cheap", "Thinking", "Quick fixes"],
    cost: 60,
    providerKey: "openrouter",
    provider: "nvidia/nemotron-3-nano-30b-a3b",
    thinking: true,
    tools: true,
    vision: false,
    group: "Open source",
    speed: "fast",
  },
  {
    id: "llama4-maverick",
    name: "Llama 4 Maverick",
    tagline: "Meta's multimodal MoE via OpenRouter",
    tags: ["Vision", "Fast", "General"],
    cost: 90,
    providerKey: "openrouter",
    provider: "meta-llama/llama-4-maverick",
    thinking: true,
    tools: true,
    vision: true,
    group: "Open source",
    speed: "fast",
  },
  {
    id: "cf-llama4-scout",
    name: "Llama 4 Scout (Edge)",
    tagline: "Cloudflare Workers AI — vision on the edge",
    tags: ["Vision", "Edge", "Cheap"],
    cost: 60,
    providerKey: "cloudflare",
    provider: "@cf/meta/llama-4-scout-17b-16e-instruct",
    thinking: true,
    tools: true,
    vision: true,
    group: "Open source",
    speed: "fast",
  },
  {
    id: "cf-llama33-70b",
    name: "Llama 3.3 70B (Edge)",
    tagline: "Cloudflare fp8-fast Llama 3.3 — reliable everyday coding",
    tags: ["Edge", "Fast", "General"],
    cost: 60,
    providerKey: "cloudflare",
    provider: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    thinking: true,
    tools: true,
    vision: false,
    group: "Open source",
    speed: "fast",
  },
];

export const MODEL_GROUPS = ["Flagship", "Fast", "Coding", "Open source"] as const;

export const DEFAULT_MODEL_ID = "om-code";

/** Ids used before the OpenMatrix rebrand / catalog cleanup. */
const LEGACY_IDS: Record<string, string> = {
  "oc-code": "om-code",
  "oc-code-max": "om-code-max",
  "oc-code-lite": "om-code-lite",
  "oc-gpt": "om-gpt",
  "oc-gpt-sol": "om-gpt-terra",
  "cerebras-oss120b": "groq-oss120b",
  "command-a": "glm-4-6",
  "nemotron-super": "nemotron-nano-30b",
  "bl-deepseek-v4-pro": "nemotron-ultra-550b",
  "bl-qwen37-max": "qwen3-max",
  "bl-grok-build": "om-code-max",
  "bl-kimi-k27-code": "qwen3-coder-plus",
  "bl-glm-52": "glm-4-6",
};

export function getModel(id: string): CodexModel {
  const resolved = LEGACY_IDS[id] ?? id;
  return (
    CODEX_MODELS.find((m) => m.id === resolved) ??
    CODEX_MODELS.find((m) => m.id === DEFAULT_MODEL_ID) ??
    CODEX_MODELS[0]
  );
}

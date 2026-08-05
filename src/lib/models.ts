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
  /**
   * Per-request output budget that this provider/plan actually accepts. Sending
   * a provider's default (often 32k-64k) makes free tiers reject the whole
   * request, which is why every non-Lovable model pins its own ceiling.
   */
  maxOutput?: number;
  /** Grouping label used by the model picker. */
  group: "Flagship" | "Fast" | "Coding" | "Open source";
  /** Rough speed hint used for the icon in the model picker. */
  speed: "fast" | "balanced" | "deep";
}

/**
 * Curated catalog. Every entry below was called live (streaming + tool calling)
 * before shipping; providers whose keys are out of credit or whose ids 404 are
 * removed rather than hidden, so the picker never offers a dead model.
 *
 * Verified providers: Lovable AI, Hugging Face router, Bazaarlink, Cerebras,
 * Groq, Qwen Cloud, Mistral, Cloudflare Workers AI.
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
    id: "nemotron-ultra-550b",
    name: "Nemotron Ultra 550B",
    tagline: "NVIDIA's largest open reasoning model, served by Hugging Face",
    tags: ["550B", "Frontier", "Architecture"],
    cost: 200,
    providerKey: "huggingface",
    provider: "nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-NVFP4",
    thinking: true,
    tools: true,
    vision: false,
    maxOutput: 8000,
    group: "Flagship",
    speed: "deep",
  },
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    tagline: "DeepSeek's frontier reasoning + coding model",
    tags: ["Reasoning", "Code", "Long tasks"],
    cost: 200,
    providerKey: "huggingface",
    provider: "deepseek-ai/DeepSeek-V4-Pro",
    thinking: true,
    tools: true,
    vision: false,
    maxOutput: 8000,
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
    maxOutput: 3500,
    group: "Fast",
    speed: "fast",
  },
  {
    id: "cerebras-oss120b",
    name: "GPT-OSS 120B (Cerebras)",
    tagline: "Same open 120B on Cerebras wafer-scale inference",
    tags: ["Fastest", "Tools", "Reasoning"],
    cost: 80,
    providerKey: "cerebras",
    provider: "gpt-oss-120b",
    thinking: true,
    tools: true,
    vision: false,
    maxOutput: 4000,
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
    maxOutput: 3500,
    group: "Fast",
    speed: "fast",
  },
  {
    id: "groq-llama33",
    name: "Llama 3.3 70B (Groq)",
    tagline: "Reliable general model at Groq speed",
    tags: ["Fast", "General", "Tools"],
    cost: 60,
    providerKey: "groq",
    provider: "llama-3.3-70b-versatile",
    thinking: false,
    tools: true,
    vision: false,
    maxOutput: 3500,
    group: "Fast",
    speed: "fast",
  },
  {
    id: "minimax-m27",
    name: "MiniMax M2.7",
    tagline: "Fast agentic reasoning model via Bazaarlink",
    tags: ["Agentic", "Thinking", "Tools"],
    cost: 90,
    providerKey: "bazaarlink",
    provider: "minimax-m2.7",
    thinking: true,
    tools: true,
    vision: false,
    maxOutput: 1500,
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
    maxOutput: 6000,
    group: "Coding",
    speed: "balanced",
  },
  {
    id: "qwen3-coder-flash",
    name: "Qwen3 Coder Flash",
    tagline: "Cheaper, quicker Qwen coder for small edits",
    tags: ["Cheap", "Quick fixes", "Tools"],
    cost: 80,
    providerKey: "qwen",
    provider: "qwen3-coder-flash",
    thinking: true,
    tools: true,
    vision: false,
    maxOutput: 6000,
    group: "Coding",
    speed: "fast",
  },
  {
    id: "glm-47-cerebras",
    name: "GLM 4.7 (Cerebras)",
    tagline: "Zhipu GLM 4.7 at Cerebras speed, strong tool use",
    tags: ["Agentic", "Code", "Fast"],
    cost: 110,
    providerKey: "cerebras",
    provider: "zai-glm-4.7",
    thinking: true,
    tools: true,
    vision: false,
    maxOutput: 4000,
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
    thinking: false,
    tools: true,
    vision: false,
    maxOutput: 6000,
    group: "Coding",
    speed: "fast",
  },
  {
    id: "magistral-medium",
    name: "Magistral Medium",
    tagline: "Mistral's reasoning model for tricky bugs",
    tags: ["Reasoning", "Debugging", "Tools"],
    cost: 120,
    providerKey: "mistral",
    provider: "magistral-medium-latest",
    thinking: true,
    tools: true,
    vision: false,
    maxOutput: 6000,
    group: "Coding",
    speed: "balanced",
  },

  // ---------- Open source / vision ----------
  {
    id: "qwen3-vl-plus",
    name: "Qwen3 VL Plus",
    tagline: "Qwen vision model — screenshots straight to code",
    tags: ["Vision", "OCR", "Screenshot → UI"],
    cost: 130,
    providerKey: "qwen",
    provider: "qwen3-vl-plus",
    thinking: true,
    tools: true,
    vision: true,
    maxOutput: 6000,
    group: "Open source",
    speed: "balanced",
  },
  {
    id: "mistral-medium",
    name: "Mistral Medium 3",
    tagline: "Balanced Mistral model with vision",
    tags: ["Vision", "Balanced", "Docs"],
    cost: 110,
    providerKey: "mistral",
    provider: "mistral-medium-latest",
    thinking: false,
    tools: true,
    vision: true,
    maxOutput: 6000,
    group: "Open source",
    speed: "balanced",
  },
  {
    id: "gemma4-cerebras",
    name: "Gemma 4 31B",
    tagline: "Google's open Gemma 4 on Cerebras",
    tags: ["Open", "Fast", "General"],
    cost: 60,
    providerKey: "cerebras",
    provider: "gemma-4-31b",
    thinking: false,
    tools: true,
    vision: false,
    maxOutput: 4000,
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
    thinking: false,
    tools: true,
    vision: true,
    maxOutput: 4000,
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
    thinking: false,
    tools: true,
    vision: false,
    maxOutput: 4000,
    group: "Open source",
    speed: "fast",
  },
];

export const MODEL_GROUPS = ["Flagship", "Fast", "Coding", "Open source"] as const;

export const DEFAULT_MODEL_ID = "om-code";

/**
 * Ordered rescue list used when the chosen model's provider refuses the request
 * (out of credits, rate limited, model retired). These are all live-verified and
 * spread across independent providers so a single outage can't stall a build.
 */
export const FALLBACK_MODEL_IDS = [
  "glm-47-cerebras",
  "groq-oss120b",
  "qwen3-coder-plus",
  "codestral",
  "nemotron-ultra-550b",
  "cf-llama33-70b",
];

/** Ids used before the OpenMatrix rebrand / catalog cleanups. */
const LEGACY_IDS: Record<string, string> = {
  "oc-code": "om-code",
  "oc-code-max": "om-code-max",
  "oc-code-lite": "om-code-lite",
  "oc-gpt": "om-gpt",
  "oc-gpt-sol": "om-gpt-terra",
  "om-gpt-terra": "om-gpt",
  "groq-compound": "groq-oss120b",
  "qwen3-max": "qwen3-coder-plus",
  "qwen-vl-max": "qwen3-vl-plus",
  "qwen3-coder": "qwen3-coder-plus",
  "deepseek-v3": "deepseek-v4-pro",
  "glm-4-6": "deepseek-v4-pro",
  "glm-52": "deepseek-v4-pro",
  "kimi-k27-code": "qwen3-coder-plus",
  "qwen3-coder-next": "qwen3-coder-plus",
  "nemotron-nano-30b": "minimax-m27",
  "llama4-maverick": "cf-llama4-scout",
  "command-a": "deepseek-v4-pro",
  "nemotron-super": "minimax-m27",
  "bl-deepseek-v4-pro": "deepseek-v4-pro",
  "bl-qwen37-max": "qwen3-coder-plus",
  "bl-grok-build": "om-code-max",
  "bl-kimi-k27-code": "qwen3-coder-plus",
  "bl-glm-52": "deepseek-v4-pro",
};

export function getModel(id: string): CodexModel {
  const resolved = LEGACY_IDS[id] ?? id;
  return (
    CODEX_MODELS.find((m) => m.id === resolved) ??
    CODEX_MODELS.find((m) => m.id === DEFAULT_MODEL_ID) ??
    CODEX_MODELS[0]
  );
}

/** The chosen model followed by rescue models on other providers. */
export function modelChain(id: string): CodexModel[] {
  const primary = getModel(id);
  const chain = [primary];
  for (const fid of FALLBACK_MODEL_IDS) {
    const m = getModel(fid);
    if (!chain.some((c) => c.id === m.id) && !chain.some((c) => c.providerKey === m.providerKey)) {
      chain.push(m);
    }
  }
  return chain;
}

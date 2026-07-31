export type ProviderKey = "lovable" | "openrouter" | "groq" | "cerebras" | "mistral";

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
  /** Rough speed hint used for the icon in the model picker. */
  speed: "fast" | "balanced" | "deep";
}

export const CODEX_MODELS: CodexModel[] = [
  {
    id: "nemotron-super",
    name: "Nemotron 3 Super",
    tagline: "NVIDIA reasoning + coding, free tier",
    tags: ["Thinking", "React", "Refactoring"],
    cost: 120,
    providerKey: "openrouter",
    provider: "nvidia/nemotron-3-super-120b-a12b:free",
    thinking: true,
    tools: false,
    speed: "balanced",
  },
  {
    id: "nemotron-ultra",
    name: "Nemotron 3 Ultra",
    tagline: "550B NVIDIA flagship for hard builds",
    tags: ["Thinking", "Architecture", "Multi-file"],
    cost: 200,
    providerKey: "openrouter",
    provider: "nvidia/nemotron-3-ultra-550b-a55b:free",
    thinking: true,
    tools: false,
    speed: "deep",
  },
  {
    id: "qwen3-coder",
    name: "Qwen3 Coder",
    tagline: "Specialised code model, great at whole files",
    tags: ["Code", "Node & Python", "APIs"],
    cost: 100,
    providerKey: "openrouter",
    provider: "qwen/qwen3-coder",
    thinking: false,
    tools: true,
    speed: "balanced",
  },
  {
    id: "cerebras-oss120b",
    name: "Opencimpco Turbo",
    tagline: "GPT-OSS 120B on Cerebras — insanely fast",
    tags: ["Fastest", "Quick fixes", "HTML / CSS / JS"],
    cost: 80,
    providerKey: "cerebras",
    provider: "gpt-oss-120b",
    thinking: false,
    tools: true,
    speed: "fast",
  },
  {
    id: "groq-oss120b",
    name: "Opencimpco Flash",
    tagline: "GPT-OSS 120B on Groq with web search",
    tags: ["Fast", "Tools", "Everyday code"],
    cost: 80,
    providerKey: "groq",
    provider: "openai/gpt-oss-120b",
    thinking: false,
    tools: true,
    speed: "fast",
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
    speed: "fast",
  },
  {
    id: "codex-0.1",
    name: "Opencimpco Fast",
    tagline: "Gemini Flash via Lovable AI",
    tags: ["HTML / CSS / JS", "React", "Quick fixes"],
    cost: 100,
    providerKey: "lovable",
    provider: "google/gemini-3.6-flash",
    thinking: false,
    tools: true,
    speed: "fast",
  },
  {
    id: "codex-pro",
    name: "Opencimpco Pro",
    tagline: "Gemini Pro via Lovable AI",
    tags: ["Architecture", "Refactoring", "Multi-file"],
    cost: 500,
    providerKey: "lovable",
    provider: "google/gemini-2.5-pro",
    thinking: true,
    tools: true,
    speed: "deep",
  },
];

export const DEFAULT_MODEL_ID = "nemotron-super";

export function getModel(id: string): CodexModel {
  return (
    CODEX_MODELS.find((m) => m.id === id) ??
    CODEX_MODELS.find((m) => m.id === DEFAULT_MODEL_ID) ??
    CODEX_MODELS[0]
  );
}

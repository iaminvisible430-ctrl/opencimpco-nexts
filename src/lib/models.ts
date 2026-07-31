export type ProviderKey =
  | "lovable"
  | "openrouter"
  | "groq"
  | "cerebras"
  | "mistral"
  | "google"
  | "cohere";

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
    id: "oc-code-max",
    name: "Opencimpco Code Max",
    tagline: "Lovable AI flagship — best multi-file engineering",
    tags: ["Best coding", "Multi-file", "Architecture"],
    cost: 400,
    providerKey: "lovable",
    provider: "google/gemini-3.1-pro-preview",
    thinking: true,
    tools: true,
    speed: "deep",
  },
  {
    id: "oc-code",
    name: "Opencimpco Code",
    tagline: "Lovable AI default — fast, strong full-stack coding",
    tags: ["Balanced", "React", "Streaming"],
    cost: 120,
    providerKey: "lovable",
    provider: "google/gemini-3.6-flash",
    thinking: false,
    tools: true,
    speed: "fast",
  },
  {
    id: "oc-gpt",
    name: "Opencimpco GPT",
    tagline: "GPT-5.4 via Lovable AI for tricky logic",
    tags: ["Reasoning", "Debugging", "Refactors"],
    cost: 350,
    providerKey: "lovable",
    provider: "openai/gpt-5.4",
    thinking: true,
    tools: true,
    speed: "deep",
  },
  {
    id: "gemini-pro-direct",
    name: "Gemini 2.5 Pro",
    tagline: "Direct Google API with your key",
    tags: ["Long context", "Thinking", "Multimodal"],
    cost: 100,
    providerKey: "google",
    provider: "gemini-2.5-pro",
    thinking: true,
    tools: true,
    speed: "deep",
  },
  {
    id: "gemini-flash-direct",
    name: "Gemini 2.5 Flash",
    tagline: "Direct Google API — quick iterations",
    tags: ["Fast", "Cheap", "Everyday code"],
    cost: 60,
    providerKey: "google",
    provider: "gemini-2.5-flash",
    thinking: false,
    tools: true,
    speed: "fast",
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
    id: "command-a",
    name: "Cohere Command A",
    tagline: "Cohere's flagship for docs and tooling",
    tags: ["Docs", "Tools", "Long context"],
    cost: 100,
    providerKey: "cohere",
    provider: "command-a-03-2025",
    thinking: false,
    tools: true,
    speed: "balanced",
  },
];

export const DEFAULT_MODEL_ID = "oc-code";

export function getModel(id: string): CodexModel {
  return (
    CODEX_MODELS.find((m) => m.id === id) ??
    CODEX_MODELS.find((m) => m.id === DEFAULT_MODEL_ID) ??
    CODEX_MODELS[0]
  );
}

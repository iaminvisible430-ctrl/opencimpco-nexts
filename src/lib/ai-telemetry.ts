/**
 * Tiny in-memory telemetry store for the AI panel: which model ran, how long it
 * took and how much text came back. Deliberately not persisted — it describes
 * the current session only.
 */
export type AiRequest = {
  id: string;
  model: string;
  provider: string;
  startedAt: number;
  ms: number;
  bytes: number;
  contextChars: number;
  ok: boolean;
  error?: string;
};

const MAX = 40;
const store = new Map<string, AiRequest[]>();
const subs = new Set<() => void>();

export function recordRequest(chatId: string, r: AiRequest) {
  const list = store.get(chatId) ?? [];
  store.set(chatId, [r, ...list].slice(0, MAX));
  subs.forEach((f) => f());
}

export function getRequests(chatId: string): AiRequest[] {
  return store.get(chatId) ?? [];
}

export function subscribeRequests(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
